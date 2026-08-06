#!/usr/bin/env python3
"""Deterministic release coordination and validation for MoneyTrail.

This utility is intentionally dependency-free so OpenClaw scheduled and manual
execution paths can use the same entry point.
"""

from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import os
import shutil
import sys
import tempfile
import uuid
from pathlib import Path
from typing import Any, Iterator


SCHEMA_VERSION = 1
DEFAULT_TTL_MINUTES = 180
DEFAULT_GATE_THRESHOLD = 70.0
PRODUCTION_SUPABASE_REF = "iinzcnqwhltxjilpkojr"


def utc_now() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


def iso(value: dt.datetime) -> str:
    return value.astimezone(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def parse_time(value: str) -> dt.datetime:
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def default_lease_path() -> Path:
    configured = os.environ.get("MONEYTRAIL_RELEASE_LEASE_PATH")
    if configured:
        return Path(configured).expanduser().resolve()
    return Path.home() / ".openclaw" / "workspace" / "state" / "moneytrail_release_lease.json"


def json_out(payload: dict[str, Any]) -> None:
    print(json.dumps(payload, indent=2, sort_keys=True))


def load_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"cannot read JSON from {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise RuntimeError(f"expected JSON object in {path}")
    return value


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    temp_path = Path(temporary)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_path, 0o600)
        os.replace(temp_path, path)
    finally:
        if temp_path.exists():
            temp_path.unlink()


@contextlib.contextmanager
def lease_mutex(lease_path: Path) -> Iterator[None]:
    mutex_path = lease_path.with_suffix(lease_path.suffix + ".lock")
    mutex_path.parent.mkdir(parents=True, exist_ok=True)
    with mutex_path.open("a+", encoding="utf-8") as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def is_expired(lease: dict[str, Any], now: dt.datetime | None = None) -> bool:
    current = now or utc_now()
    expires_at = lease.get("expires_at")
    if not isinstance(expires_at, str):
        return True
    try:
        return parse_time(expires_at) <= current
    except ValueError:
        return True


def append_history(lease_path: Path, payload: dict[str, Any]) -> None:
    history_path = lease_path.with_name("moneytrail_release_history.jsonl")
    history_path.parent.mkdir(parents=True, exist_ok=True)
    with history_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, sort_keys=True) + "\n")


def require_owner(lease: dict[str, Any], release_id: str, owner: str) -> None:
    if lease.get("release_id") != release_id or lease.get("owner") != owner:
        raise PermissionError("release lease owner or release_id does not match")


def command_claim(args: argparse.Namespace) -> int:
    lease_path = Path(args.lease_path).expanduser().resolve()
    now = utc_now()
    expires = now + dt.timedelta(minutes=args.ttl_minutes)
    with lease_mutex(lease_path):
        current = load_json(lease_path)
        if current and not is_expired(current, now):
            json_out(
                {
                    "status": "busy",
                    "lease_path": str(lease_path),
                    "active_release": current,
                    "next_action": "exit without implementing; another MoneyTrail release owns the lease",
                }
            )
            return 0
        if current:
            append_history(
                lease_path,
                {
                    **current,
                    "released_at": iso(now),
                    "outcome": "expired_reclaimed",
                },
            )
        release_id = args.release_id or str(uuid.uuid4())
        lease = {
            "schema_version": SCHEMA_VERSION,
            "release_id": release_id,
            "owner": args.owner,
            "automation_id": args.automation_id,
            "candidate_id": args.candidate_id,
            "branch": args.branch,
            "phase": "claimed",
            "claimed_at": iso(now),
            "heartbeat_at": iso(now),
            "expires_at": iso(expires),
        }
        atomic_write_json(lease_path, lease)
    json_out({"status": "claimed", "lease_path": str(lease_path), "lease": lease})
    return 0


def command_heartbeat(args: argparse.Namespace) -> int:
    lease_path = Path(args.lease_path).expanduser().resolve()
    now = utc_now()
    with lease_mutex(lease_path):
        lease = load_json(lease_path)
        if not lease:
            raise RuntimeError("no active MoneyTrail release lease")
        require_owner(lease, args.release_id, args.owner)
        if is_expired(lease, now):
            raise RuntimeError("MoneyTrail release lease has expired")
        lease["phase"] = args.phase or lease.get("phase")
        lease["heartbeat_at"] = iso(now)
        lease["expires_at"] = iso(now + dt.timedelta(minutes=args.ttl_minutes))
        atomic_write_json(lease_path, lease)
    json_out({"status": "renewed", "lease": lease})
    return 0


def command_release(args: argparse.Namespace) -> int:
    lease_path = Path(args.lease_path).expanduser().resolve()
    now = utc_now()
    with lease_mutex(lease_path):
        lease = load_json(lease_path)
        if not lease:
            raise RuntimeError("no active MoneyTrail release lease")
        require_owner(lease, args.release_id, args.owner)
        completed = {
            **lease,
            "released_at": iso(now),
            "outcome": args.outcome,
            "manifest_path": args.manifest_path,
        }
        append_history(lease_path, completed)
        lease_path.unlink()
    json_out({"status": "released", "release": completed})
    return 0


def command_status(args: argparse.Namespace) -> int:
    lease_path = Path(args.lease_path).expanduser().resolve()
    with lease_mutex(lease_path):
        lease = load_json(lease_path)
    if not lease:
        json_out({"status": "available", "lease_path": str(lease_path)})
        return 0
    json_out(
        {
            "status": "expired" if is_expired(lease) else "busy",
            "lease_path": str(lease_path),
            "lease": lease,
        }
    )
    return 0


def bounded(value: float, name: str) -> float:
    if value < 0 or value > 100:
        raise ValueError(f"{name} must be between 0 and 100")
    return value


def command_gate(args: argparse.Namespace) -> int:
    values = {
        "decision_value": bounded(args.decision_value, "decision_value"),
        "coverage_gap": bounded(args.coverage_gap, "coverage_gap"),
        "user_impact": bounded(args.user_impact, "user_impact"),
        "evidence_quality": bounded(args.evidence_quality, "evidence_quality"),
        "freshness_gain": bounded(args.freshness_gain, "freshness_gain"),
        "reversibility": bounded(args.reversibility, "reversibility"),
        "operational_risk": bounded(args.operational_risk, "operational_risk"),
        "effort": bounded(args.effort, "effort"),
    }
    positive = (
        0.25 * values["decision_value"]
        + 0.15 * values["coverage_gap"]
        + 0.15 * values["user_impact"]
        + 0.15 * values["evidence_quality"]
        + 0.10 * values["freshness_gain"]
        + 0.10 * values["reversibility"]
        + 0.10 * (100 - values["effort"])
    )
    score = round(max(0.0, positive - 0.20 * values["operational_risk"]), 2)
    blockers = []
    if args.health_status != "green":
        blockers.append(f"system health is {args.health_status}")
    if args.overlaps_active_work:
        blockers.append("candidate overlaps active or unfinished work")
    if args.source_legal_status != "clear":
        blockers.append(f"source/legal status is {args.source_legal_status}")
    decision = "ship" if score >= args.threshold and not blockers else "noop"
    json_out(
        {
            "status": "evaluated",
            "decision": decision,
            "score": score,
            "threshold": args.threshold,
            "inputs": values,
            "blockers": blockers,
            "next_action": (
                "claim the release lease and implement one bounded slice"
                if decision == "ship"
                else "record a no-op run; do not invent or deploy a feature"
            ),
        }
    )
    return 0


def manifest_skeleton(release_id: str, title: str, candidate_id: str) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "release_id": release_id,
        "status": "planning",
        "candidate": {
            "id": candidate_id,
            "title": title,
            "gate_decision": "ship",
            "gate_score": None,
        },
        "git": {
            "repository": "vadEGO/MoneyTrailDash",
            "branch": None,
            "pull_request": None,
            "tested_commit": None,
            "merged_commit": None,
        },
        "openclaw": {
            "entrypoint": "ops/release/moneytrail_release.py",
            "workflow_name": None,
            "manual_run_id": None,
            "scheduled_job_id": None,
            "automation_policy_version": SCHEMA_VERSION,
        },
        "supabase": {
            "production_project_ref": PRODUCTION_SUPABASE_REF,
            "preview_project_ref": None,
            "migrations": [],
            "security_verified": False,
            "data_verified": False,
        },
        "vercel": {
            "project_id": "prj_pUd6DeaIF0zedi6D6HOIERhIEgfj",
            "preview_deployment_id": None,
            "preview_commit": None,
            "production_deployment_id": None,
            "production_commit": None,
            "status": None,
        },
        "freshness": {"baseline": {}, "after": {}, "regressions": []},
        "rollback": {
            "git_commit": None,
            "vercel_deployment_id": None,
            "data_contract_version": None,
        },
    }


def command_init_manifest(args: argparse.Namespace) -> int:
    path = Path(args.path).expanduser().resolve()
    if path.exists() and not args.force:
        raise FileExistsError(f"manifest already exists: {path}")
    manifest = manifest_skeleton(args.release_id, args.title, args.candidate_id)
    atomic_write_json(path, manifest)
    json_out({"status": "created", "manifest_path": str(path), "manifest": manifest})
    return 0


def expect(value: Any, path: str, errors: list[str]) -> None:
    if value in (None, "", [], {}):
        errors.append(f"missing {path}")


def command_validate_manifest(args: argparse.Namespace) -> int:
    path = Path(args.path).expanduser().resolve()
    manifest = load_json(path)
    if not manifest:
        raise RuntimeError(f"manifest not found: {path}")
    errors: list[str] = []
    for field in ("release_id", "candidate", "git", "openclaw", "supabase", "vercel", "freshness", "rollback"):
        expect(manifest.get(field), field, errors)
    git = manifest.get("git") or {}
    openclaw = manifest.get("openclaw") or {}
    supabase = manifest.get("supabase") or {}
    vercel = manifest.get("vercel") or {}
    freshness = manifest.get("freshness") or {}
    rollback = manifest.get("rollback") or {}
    expect(git.get("repository"), "git.repository", errors)
    expect(openclaw.get("entrypoint"), "openclaw.entrypoint", errors)
    expect(freshness.get("baseline"), "freshness.baseline", errors)

    if args.phase in {"preview", "production"}:
        for field in ("branch", "pull_request", "tested_commit"):
            expect(git.get(field), f"git.{field}", errors)
        expect(openclaw.get("manual_run_id"), "openclaw.manual_run_id", errors)
        preview_ref = supabase.get("preview_project_ref")
        expect(preview_ref, "supabase.preview_project_ref", errors)
        if preview_ref == supabase.get("production_project_ref"):
            errors.append("Supabase preview project must differ from production")
        expect(vercel.get("preview_deployment_id"), "vercel.preview_deployment_id", errors)
        expect(vercel.get("preview_commit"), "vercel.preview_commit", errors)
        if vercel.get("preview_commit") and vercel.get("preview_commit") != git.get("tested_commit"):
            errors.append("Vercel preview commit does not match git.tested_commit")

    if args.phase == "production":
        expect(git.get("merged_commit"), "git.merged_commit", errors)
        if not supabase.get("security_verified"):
            errors.append("Supabase security verification is incomplete")
        if not supabase.get("data_verified"):
            errors.append("Supabase data verification is incomplete")
        expect(vercel.get("production_deployment_id"), "vercel.production_deployment_id", errors)
        if vercel.get("status") != "READY":
            errors.append("Vercel production status must be READY")
        expect(vercel.get("production_commit"), "vercel.production_commit", errors)
        if vercel.get("production_commit") and vercel.get("production_commit") != git.get("merged_commit"):
            errors.append("Vercel production commit does not match git.merged_commit")
        expect(freshness.get("after"), "freshness.after", errors)
        if freshness.get("regressions"):
            errors.append("freshness regressions must be empty")
        for field in ("git_commit", "vercel_deployment_id", "data_contract_version"):
            expect(rollback.get(field), f"rollback.{field}", errors)

    json_out(
        {
            "status": "valid" if not errors else "invalid",
            "phase": args.phase,
            "manifest_path": str(path),
            "errors": errors,
        }
    )
    return 0 if not errors else 4


def command_verify_automations(args: argparse.Namespace) -> int:
    policy_path = Path(args.policy).expanduser().resolve()
    policy = load_json(policy_path)
    if not policy:
        raise RuntimeError(f"automation policy not found: {policy_path}")
    failures: list[str] = []
    checked = []
    for automation in policy.get("automations", []):
        path = Path(str(automation.get("active_path"))).expanduser()
        if not path.exists():
            failures.append(f"{automation.get('id')}: active automation file missing")
            continue
        text = path.read_text(encoding="utf-8")
        for clause in automation.get("required_clauses", []):
            if clause not in text:
                failures.append(f"{automation.get('id')}: missing required clause {clause!r}")
        expected_schedule = automation.get("expected_schedule")
        if expected_schedule and expected_schedule not in text:
            failures.append(f"{automation.get('id')}: schedule drift")
        checked.append(automation.get("id"))
    json_out(
        {
            "status": "valid" if not failures else "invalid",
            "policy_version": policy.get("policy_version"),
            "checked": checked,
            "failures": failures,
        }
    )
    return 0 if not failures else 5


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def runtime_source_files() -> list[Path]:
    root = Path(__file__).resolve().parent
    return [
        root / "moneytrail_release.py",
        root / "contract.md",
        root / "release-manifest.schema.json",
        root / "automation-policy.json",
    ]


def command_install_runtime(args: argparse.Namespace) -> int:
    destination = Path(args.destination).expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)
    installed: dict[str, str] = {}
    for source in runtime_source_files():
        if not source.exists():
            raise RuntimeError(f"runtime source file missing: {source}")
        target = destination / source.name
        fd, temporary = tempfile.mkstemp(prefix=f".{source.name}.", dir=str(destination))
        temp_path = Path(temporary)
        os.close(fd)
        try:
            shutil.copyfile(source, temp_path)
            os.chmod(temp_path, 0o755 if source.name.endswith(".py") else 0o644)
            os.replace(temp_path, target)
        finally:
            if temp_path.exists():
                temp_path.unlink()
        installed[source.name] = sha256(target)
    runtime_manifest = {
        "schema_version": SCHEMA_VERSION,
        "source_repository": "vadEGO/MoneyTrailDash",
        "source_commit": args.source_commit,
        "installed_at": iso(utc_now()),
        "files": installed,
    }
    atomic_write_json(destination / "runtime-manifest.json", runtime_manifest)
    json_out(
        {
            "status": "installed",
            "destination": str(destination),
            "runtime_manifest": runtime_manifest,
        }
    )
    return 0


def command_verify_runtime(args: argparse.Namespace) -> int:
    destination = Path(args.destination).expanduser().resolve()
    runtime_manifest = load_json(destination / "runtime-manifest.json")
    if not runtime_manifest:
        raise RuntimeError("runtime manifest is missing")
    failures = []
    for name, expected in (runtime_manifest.get("files") or {}).items():
        path = destination / name
        if not path.exists():
            failures.append(f"{name}: missing")
        elif sha256(path) != expected:
            failures.append(f"{name}: hash mismatch")
    if args.source_commit and runtime_manifest.get("source_commit") != args.source_commit:
        failures.append("source commit mismatch")
    json_out(
        {
            "status": "valid" if not failures else "invalid",
            "destination": str(destination),
            "source_commit": runtime_manifest.get("source_commit"),
            "failures": failures,
        }
    )
    return 0 if not failures else 6


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="MoneyTrail release coordinator")
    parser.add_argument("--lease-path", default=str(default_lease_path()))
    subparsers = parser.add_subparsers(dest="command", required=True)

    claim = subparsers.add_parser("claim")
    claim.add_argument("--owner", required=True)
    claim.add_argument("--automation-id", required=True)
    claim.add_argument("--candidate-id", required=True)
    claim.add_argument("--branch")
    claim.add_argument("--release-id")
    claim.add_argument("--ttl-minutes", type=int, default=DEFAULT_TTL_MINUTES)
    claim.set_defaults(func=command_claim)

    heartbeat = subparsers.add_parser("heartbeat")
    heartbeat.add_argument("--owner", required=True)
    heartbeat.add_argument("--release-id", required=True)
    heartbeat.add_argument("--phase")
    heartbeat.add_argument("--ttl-minutes", type=int, default=DEFAULT_TTL_MINUTES)
    heartbeat.set_defaults(func=command_heartbeat)

    release = subparsers.add_parser("release")
    release.add_argument("--owner", required=True)
    release.add_argument("--release-id", required=True)
    release.add_argument("--outcome", choices=["completed", "noop", "aborted", "failed"], required=True)
    release.add_argument("--manifest-path")
    release.set_defaults(func=command_release)

    status = subparsers.add_parser("status")
    status.set_defaults(func=command_status)

    gate = subparsers.add_parser("gate")
    for field in (
        "decision-value",
        "coverage-gap",
        "user-impact",
        "evidence-quality",
        "freshness-gain",
        "reversibility",
        "operational-risk",
        "effort",
    ):
        gate.add_argument(f"--{field}", type=float, required=True)
    gate.add_argument("--threshold", type=float, default=DEFAULT_GATE_THRESHOLD)
    gate.add_argument("--health-status", choices=["green", "degraded", "red"], default="green")
    gate.add_argument("--overlaps-active-work", action="store_true")
    gate.add_argument("--source-legal-status", choices=["clear", "uncertain", "blocked"], default="clear")
    gate.set_defaults(func=command_gate)

    init_manifest = subparsers.add_parser("init-manifest")
    init_manifest.add_argument("--path", required=True)
    init_manifest.add_argument("--release-id", required=True)
    init_manifest.add_argument("--candidate-id", required=True)
    init_manifest.add_argument("--title", required=True)
    init_manifest.add_argument("--force", action="store_true")
    init_manifest.set_defaults(func=command_init_manifest)

    validate = subparsers.add_parser("validate-manifest")
    validate.add_argument("--path", required=True)
    validate.add_argument("--phase", choices=["planning", "preview", "production"], required=True)
    validate.set_defaults(func=command_validate_manifest)

    verify = subparsers.add_parser("verify-automations")
    verify.add_argument(
        "--policy",
        default=str(Path(__file__).resolve().parent / "automation-policy.json"),
    )
    verify.set_defaults(func=command_verify_automations)

    runtime_default = str(Path.home() / ".openclaw" / "workspace" / "ops" / "moneytrail-release")
    install_runtime = subparsers.add_parser("install-runtime")
    install_runtime.add_argument("--destination", default=runtime_default)
    install_runtime.add_argument("--source-commit", required=True)
    install_runtime.set_defaults(func=command_install_runtime)

    verify_runtime = subparsers.add_parser("verify-runtime")
    verify_runtime.add_argument("--destination", default=runtime_default)
    verify_runtime.add_argument("--source-commit")
    verify_runtime.set_defaults(func=command_verify_runtime)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return int(args.func(args))
    except (RuntimeError, PermissionError, ValueError, FileExistsError) as exc:
        json_out({"status": "error", "error": str(exc)})
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
