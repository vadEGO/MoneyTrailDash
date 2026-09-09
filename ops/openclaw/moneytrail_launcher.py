#!/usr/bin/env python3
"""Validate and dispatch the canonical MoneyTrail process contract.

Hermes is the scheduler, while OpenClaw remains the source of the process
definitions. This small entry point gives both manual and scheduled callers the
same fail-closed validation, runtime hash checks, and single-process lock before
delegating to the existing migrated-process runner.
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Sequence


WORKSPACE = Path(os.environ.get("MONEYTRAIL_WORKSPACE", "/Users/vaddylandbot/.openclaw/workspace"))
DEFAULT_MANIFEST = WORKSPACE / "ops" / "hermes" / "migrated_processes.json"
DEFAULT_RUNNER = WORKSPACE / "ops" / "hermes" / "run_migrated_process.py"
DEFAULT_RUNTIME = Path(os.environ.get(
    "MONEYTRAIL_RUNTIME_DIR",
    "/Users/vaddylandbot/.hermes/runtime/moneytrail/current",
))
LOCK_PATH = WORKSPACE / "data" / "moneytrail-engine" / "shared-process.lock"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"cannot read JSON manifest {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise RuntimeError(f"manifest must be an object: {path}")
    return value


def validate_process(process_id: str, manifest_path: Path, runner_path: Path, runtime_dir: Path) -> dict[str, Any]:
    if not process_id.startswith("moneytrail_"):
        raise RuntimeError(f"process is outside the MoneyTrail contract: {process_id}")
    if not manifest_path.is_file():
        raise RuntimeError(f"process manifest is missing: {manifest_path}")
    if not runner_path.is_file():
        raise RuntimeError(f"migrated process runner is missing: {runner_path}")

    manifest = load_json(manifest_path)
    processes = manifest.get("processes")
    if not isinstance(processes, dict) or not isinstance(processes.get(process_id), dict):
        raise RuntimeError(f"unknown MoneyTrail process: {process_id}")
    spec = processes[process_id]
    argv = spec.get("argv")
    cwd = spec.get("cwd")
    if not isinstance(argv, list) or not argv or any(not isinstance(item, str) or not item for item in argv):
        raise RuntimeError(f"invalid argv for process: {process_id}")
    if not isinstance(cwd, str) or not Path(cwd).is_dir():
        raise RuntimeError(f"process cwd is missing for {process_id}: {cwd}")

    # Absolute script/config arguments must exist before a scheduled job starts.
    # This catches branch switches and partial installs without executing code.
    for item in argv:
        if item.startswith("/") and ("/" in item[1:] or item.endswith(".py")):
            candidate = Path(item)
            if candidate.suffix in {".py", ".sh", ".json", ".yaml", ".yml"} and not candidate.is_file():
                raise RuntimeError(f"process dependency is missing for {process_id}: {candidate}")

    runtime_manifest_path = runtime_dir / "runtime.json"
    if runtime_manifest_path.is_file():
        runtime = load_json(runtime_manifest_path)
        expected_manifest = runtime.get("manifest_sha256")
        expected_runner = runtime.get("runner_sha256")
        if expected_manifest and expected_manifest != sha256(manifest_path):
            raise RuntimeError("live process manifest differs from installed MoneyTrail runtime")
        if expected_runner and expected_runner != sha256(runner_path):
            raise RuntimeError("live migrated-process runner differs from installed MoneyTrail runtime")

    return {
        "process_id": process_id,
        "cwd": cwd,
        "argv": argv,
        "manifest": str(manifest_path),
        "runner": str(runner_path),
        "manifest_sha256": sha256(manifest_path),
        "runner_sha256": sha256(runner_path),
        "runtime_dir": str(runtime_dir),
    }


def dispatch(spec: dict[str, Any], runner_path: Path, *, dry_run: bool) -> int:
    if dry_run:
        print(json.dumps({**spec, "status": "dry_run"}, indent=2, sort_keys=True))
        return 0

    LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOCK_PATH.open("a+", encoding="utf-8") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps({
                "status": "blocked_lock",
                "process_id": spec["process_id"],
                "lock": str(LOCK_PATH),
            }, sort_keys=True))
            return 75

        env = os.environ.copy()
        env.update({
            "MONEYTRAIL_SHARED_LAUNCHER": "1",
            "MONEYTRAIL_PROCESS_ID": spec["process_id"],
        })
        completed = subprocess.run(
            [sys.executable, str(runner_path), spec["process_id"]],
            cwd=str(WORKSPACE),
            env=env,
            check=False,
        )
        return completed.returncode


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--process", required=True, help="MoneyTrail process ID from migrated_processes.json")
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--runner", type=Path, default=DEFAULT_RUNNER)
    parser.add_argument("--runtime-dir", type=Path, default=DEFAULT_RUNTIME)
    parser.add_argument("--check", action="store_true", help="Validate only; never execute or create the lock")
    parser.add_argument("--dry-run", action="store_true", help="Print the validated dispatch without executing")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        spec = validate_process(args.process, args.manifest, args.runner, args.runtime_dir)
    except RuntimeError as exc:
        print(json.dumps({"status": "blocked_validation", "error": str(exc), "process_id": args.process}), file=sys.stderr)
        return 78
    if args.check:
        print(json.dumps({**spec, "status": "validated"}, indent=2, sort_keys=True))
        return 0
    return dispatch(spec, args.runner, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
