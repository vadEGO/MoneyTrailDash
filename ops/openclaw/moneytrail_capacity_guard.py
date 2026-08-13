#!/usr/bin/env python3
"""Fail closed before a MoneyTrail run when durable-write headroom is unsafe."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Sequence


DEFAULT_MINIMUM_FREE_BYTES = 10 * 1024**3
DEFAULT_MINIMUM_FREE_PERCENT = 5.0
DEFAULT_PEAK_WRITE_BYTES = 4 * 1024**3
DEFAULT_RESERVE_MULTIPLIER = 2.0
CAPACITY_EXIT_CODE = 75


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    """Durably replace a small state file without corrupting the prior copy."""
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary_path = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_path, path)
        directory_descriptor = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_descriptor)
        finally:
            os.close(directory_descriptor)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()


def read_last_known_good(path: Path) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return None
    last_success = payload.get("last_success")
    return last_success if isinstance(last_success, dict) else None


def capacity_snapshot(path: Path) -> dict[str, int | float | str]:
    stats = os.statvfs(path)
    total_bytes = stats.f_blocks * stats.f_frsize
    free_bytes = stats.f_bavail * stats.f_frsize
    total_inodes = stats.f_files
    free_inodes = stats.f_favail
    return {
        "checked_path": str(path.resolve()),
        "checked_at": utc_now(),
        "total_bytes": total_bytes,
        "free_bytes": free_bytes,
        "free_percent": round((free_bytes / total_bytes * 100) if total_bytes else 0.0, 3),
        "total_inodes": total_inodes,
        "free_inodes": free_inodes,
    }


def evaluate_capacity(
    snapshot: dict[str, int | float | str],
    *,
    minimum_free_bytes: int,
    minimum_free_percent: float,
    expected_peak_write_bytes: int,
    reserve_multiplier: float,
) -> dict[str, Any]:
    required_free_bytes = max(minimum_free_bytes, int(expected_peak_write_bytes * reserve_multiplier))
    reasons: list[str] = []
    if int(snapshot["free_bytes"]) < required_free_bytes:
        reasons.append("free_bytes_below_required_reserve")
    if float(snapshot["free_percent"]) < minimum_free_percent:
        reasons.append("free_percent_below_required_reserve")
    if int(snapshot["free_inodes"]) <= 0:
        reasons.append("no_free_inodes")
    return {
        "status": "blocked_capacity" if reasons else "ready",
        "reasons": reasons,
        "required_free_bytes": required_free_bytes,
        "minimum_free_bytes": minimum_free_bytes,
        "minimum_free_percent": minimum_free_percent,
        "expected_peak_write_bytes": expected_peak_write_bytes,
        "reserve_multiplier": reserve_multiplier,
        "snapshot": snapshot,
    }


def persist_state(path: Path, event: dict[str, Any]) -> None:
    previous_last_success = read_last_known_good(path)
    payload: dict[str, Any] = {
        "schema_version": 1,
        "updated_at": utc_now(),
        "current": event,
        "last_success": previous_last_success,
    }
    if event.get("status") == "success":
        payload["last_success"] = event
    try:
        atomic_write_json(path, payload)
    except OSError as exc:
        # Capacity enforcement must still fail closed even when the diagnostic
        # state itself cannot be replaced. The previous state remains intact.
        print(json.dumps({"warning": "capacity_state_write_failed", "error": str(exc)}), file=sys.stderr)


def run_guarded(args: argparse.Namespace) -> int:
    workspace = args.workspace.resolve()
    state_path = args.state_path or workspace / "data/moneytrail-engine/capacity_state.json"
    snapshot = capacity_snapshot(workspace)
    capacity = evaluate_capacity(
        snapshot,
        minimum_free_bytes=args.minimum_free_bytes,
        minimum_free_percent=args.minimum_free_percent,
        expected_peak_write_bytes=args.expected_peak_write_bytes,
        reserve_multiplier=args.reserve_multiplier,
    )
    base_event: dict[str, Any] = {
        **capacity,
        "workflow_name": args.workflow_name,
        "command": args.command,
    }
    if capacity["status"] != "ready":
        event = {**base_event, "blocked_at": utc_now(), "last_known_good": read_last_known_good(state_path)}
        persist_state(state_path, event)
        print(json.dumps(event, indent=2, sort_keys=True))
        return CAPACITY_EXIT_CODE

    if args.dry_run:
        event = {**base_event, "status": "dry_run"}
        print(json.dumps(event, indent=2, sort_keys=True))
        return 0

    started_at = utc_now()
    completed = subprocess.run(args.command, cwd=workspace, check=False)
    finished_snapshot = capacity_snapshot(workspace)
    event = {
        **base_event,
        "status": "success" if completed.returncode == 0 else "command_failed",
        "started_at": started_at,
        "finished_at": utc_now(),
        "returncode": completed.returncode,
        "finished_snapshot": finished_snapshot,
    }
    persist_state(state_path, event)
    print(json.dumps(event, indent=2, sort_keys=True))
    return completed.returncode


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--workspace", type=Path, required=True)
    result.add_argument("--state-path", type=Path)
    result.add_argument("--workflow-name", required=True)
    result.add_argument(
        "--minimum-free-bytes",
        type=int,
        default=int(os.environ.get("MONEYTRAIL_MINIMUM_FREE_BYTES", DEFAULT_MINIMUM_FREE_BYTES)),
    )
    result.add_argument(
        "--minimum-free-percent",
        type=float,
        default=float(os.environ.get("MONEYTRAIL_MINIMUM_FREE_PERCENT", DEFAULT_MINIMUM_FREE_PERCENT)),
    )
    result.add_argument(
        "--expected-peak-write-bytes",
        type=int,
        default=int(os.environ.get("MONEYTRAIL_EXPECTED_PEAK_WRITE_BYTES", DEFAULT_PEAK_WRITE_BYTES)),
    )
    result.add_argument(
        "--reserve-multiplier",
        type=float,
        default=float(os.environ.get("MONEYTRAIL_RESERVE_MULTIPLIER", DEFAULT_RESERVE_MULTIPLIER)),
    )
    result.add_argument("--dry-run", action="store_true")
    result.add_argument("command", nargs=argparse.REMAINDER)
    return result


def main(argv: Sequence[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.command and args.command[0] == "--":
        args.command = args.command[1:]
    if not args.command:
        parser().error("a guarded command is required after --")
    return run_guarded(args)


if __name__ == "__main__":
    raise SystemExit(main())
