#!/usr/bin/env python3
"""Verify or install capacity-guarded MoneyTrail OpenClaw job payloads."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path
from typing import Any, Sequence


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = Path(__file__).with_name("moneytrail_capacity_jobs.json")


def load_config(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("schema_version") != 1 or not isinstance(payload.get("jobs"), list):
        raise ValueError("unsupported MoneyTrail capacity job config")
    return payload


def guarded_argv(workspace: Path, job: dict[str, Any]) -> list[str]:
    return [
        "python3",
        str(ROOT / "ops/openclaw/moneytrail_capacity_guard.py"),
        "--workspace",
        str(workspace),
        "--workflow-name",
        str(job["workflow_name"]),
        "--",
        *[str(value) for value in job["engine_argv"]],
    ]


def current_jobs() -> dict[str, dict[str, Any]]:
    completed = subprocess.run(
        ["openclaw", "cron", "list", "--json"],
        check=True,
        capture_output=True,
        text=True,
    )
    payload = json.loads(completed.stdout)
    return {job["id"]: job for job in payload.get("jobs", [])}


def verify(config: dict[str, Any], jobs: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    workspace = Path(config["workspace"])
    results: list[dict[str, Any]] = []
    for expected in config["jobs"]:
        live = jobs.get(expected["id"])
        wanted_argv = guarded_argv(workspace, expected)
        status = "missing"
        if live:
            status = "installed" if live.get("payload", {}).get("argv") == wanted_argv else "needs_update"
            if live.get("name") != expected["name"]:
                status = "name_mismatch"
        results.append({"id": expected["id"], "name": expected["name"], "status": status})
    return results


def apply(config: dict[str, Any], jobs: dict[str, dict[str, Any]]) -> None:
    workspace = Path(config["workspace"])
    for expected in config["jobs"]:
        live = jobs.get(expected["id"])
        if not live or live.get("name") != expected["name"]:
            raise RuntimeError(f"refusing to update unverified job id {expected['id']}")
        subprocess.run(
            [
                "openclaw",
                "cron",
                "edit",
                expected["id"],
                "--command-argv",
                json.dumps(guarded_argv(workspace, expected)),
                "--command-cwd",
                str(workspace),
            ],
            check=True,
        )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args(argv)
    config = load_config(args.config)
    jobs = current_jobs()
    before = verify(config, jobs)
    if args.apply:
        apply(config, jobs)
        after = verify(config, current_jobs())
    else:
        after = before
    status = "installed" if all(item["status"] == "installed" for item in after) else "needs_update"
    print(json.dumps({"status": status, "before": before, "after": after}, indent=2, sort_keys=True))
    return 0 if status == "installed" or not args.apply else 1


if __name__ == "__main__":
    raise SystemExit(main())
