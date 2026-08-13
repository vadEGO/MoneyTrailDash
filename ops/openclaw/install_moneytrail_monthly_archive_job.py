#!/usr/bin/env python3
"""Install or verify the deterministic monthly archive-review schedule."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path
from typing import Any, Sequence


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CONFIG = Path(__file__).with_name("moneytrail_monthly_archive_job.json")


def load_config(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    required = {"workspace", "declaration_key", "name", "description", "cron", "timezone"}
    if payload.get("schema_version") != 1 or not required.issubset(payload):
        raise ValueError("unsupported monthly archive job config")
    return payload


def desired_argv(config: dict[str, Any]) -> list[str]:
    return [
        "python3",
        str(ROOT / "ops/openclaw/moneytrail_capacity_guard.py"),
        "--workspace",
        str(config["workspace"]),
        "--workflow-name",
        "moneytrail_monthly_archive_review",
        "--",
        "python3",
        str(ROOT / "ops/openclaw/moneytrail_monthly_archive_review.py"),
        "--workspace",
        str(config["workspace"]),
        "--require-first-sunday",
    ]


def current_jobs() -> list[dict[str, Any]]:
    completed = subprocess.run(
        ["openclaw", "cron", "list", "--json"],
        check=True,
        capture_output=True,
        text=True,
    )
    return list(json.loads(completed.stdout).get("jobs", []))


def find_job(config: dict[str, Any], jobs: list[dict[str, Any]]) -> dict[str, Any] | None:
    matches = [
        job for job in jobs
        if job.get("declarationKey") == config["declaration_key"] or job.get("name") == config["name"]
    ]
    if len(matches) > 1:
        raise RuntimeError("multiple monthly archive review jobs found")
    return matches[0] if matches else None


def verify(config: dict[str, Any], job: dict[str, Any] | None) -> dict[str, Any]:
    if not job:
        return {"status": "missing", "id": None}
    expected_schedule = {"kind": "cron", "expr": config["cron"], "tz": config["timezone"]}
    schedule = {key: job.get("schedule", {}).get(key) for key in expected_schedule}
    valid = (
        job.get("name") == config["name"]
        and job.get("enabled") is True
        and schedule == expected_schedule
        and job.get("payload", {}).get("argv") == desired_argv(config)
        and job.get("payload", {}).get("cwd") == config["workspace"]
    )
    return {"status": "installed" if valid else "needs_update", "id": job.get("id")}


def apply(config: dict[str, Any], job: dict[str, Any] | None) -> None:
    common = [
        "--name", str(config["name"]),
        "--description", str(config["description"]),
        "--cron", str(config["cron"]),
        "--tz", str(config["timezone"]),
        "--exact",
        "--session", "isolated",
        "--command-argv", json.dumps(desired_argv(config)),
        "--command-cwd", str(config["workspace"]),
        "--no-deliver",
    ]
    if job:
        subprocess.run(["openclaw", "cron", "edit", str(job["id"]), "--enable", *common], check=True)
    else:
        subprocess.run([
            "openclaw", "cron", "add",
            "--declaration-key", str(config["declaration_key"]),
            *common,
        ], check=True)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args(argv)
    config = load_config(args.config)
    before_job = find_job(config, current_jobs())
    before = verify(config, before_job)
    if args.apply:
        apply(config, before_job)
    after = verify(config, find_job(config, current_jobs())) if args.apply else before
    print(json.dumps({"status": after["status"], "before": before, "after": after}, indent=2, sort_keys=True))
    return 0 if after["status"] == "installed" or not args.apply else 1


if __name__ == "__main__":
    raise SystemExit(main())
