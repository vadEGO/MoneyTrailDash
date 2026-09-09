#!/usr/bin/env python3
"""Install a hash-pinned MoneyTrail launcher for Hermes and manual OpenClaw runs."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path


DEFAULT_RUNTIME = Path("/Users/vaddylandbot/.hermes/runtime/moneytrail")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def source_commit(dashboard: Path) -> str:
    return subprocess.check_output(["git", "-C", str(dashboard), "rev-parse", "HEAD"], text=True).strip()


def atomic_symlink(link: Path, target: Path) -> None:
    link.parent.mkdir(parents=True, exist_ok=True)
    temporary = link.with_name(f".{link.name}.tmp-{os.getpid()}")
    try:
        temporary.unlink(missing_ok=True)
        temporary.symlink_to(target)
        os.replace(temporary, link)
    finally:
        temporary.unlink(missing_ok=True)


def install(runtime_root: Path, commit: str, workspace: Path, dashboard: Path) -> Path:
    root_manifest = workspace / "ops" / "hermes" / "migrated_processes.json"
    root_runner = workspace / "ops" / "hermes" / "run_migrated_process.py"
    launcher = dashboard / "ops" / "openclaw" / "moneytrail_launcher.py"
    for path in (launcher, root_manifest, root_runner):
        if not path.is_file():
            raise SystemExit(f"required runtime source is missing: {path}")
    release = runtime_root / commit
    release.mkdir(parents=True, exist_ok=True)
    shutil.copy2(launcher, release / "launcher.py")
    shutil.copy2(root_manifest, release / "migrated_processes.json")
    metadata = {
        "schema_version": 1,
        "source_commit": commit,
        "source_repository": "vadEGO/MoneyTrailDash",
        "launcher_sha256": sha256(release / "launcher.py"),
        "manifest_sha256": sha256(root_manifest),
        "runner_sha256": sha256(root_runner),
        "workspace": str(WORKSPACE),
        "installed_at": datetime.now(timezone.utc).isoformat(),
    }
    (release / "runtime.json").write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    atomic_symlink(runtime_root / "current", release)
    return release


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-root", type=Path, default=DEFAULT_RUNTIME)
    parser.add_argument("--workspace", type=Path, default=Path("/Users/vaddylandbot/.openclaw/workspace"))
    parser.add_argument("--dashboard-root", type=Path, default=Path("/Users/vaddylandbot/.openclaw/workspace/MoneyTrailDash"))
    parser.add_argument("--source-commit", default=None)
    args = parser.parse_args()
    commit = args.source_commit or source_commit(args.dashboard_root)
    release = install(args.runtime_root, commit, args.workspace, args.dashboard_root)
    print(json.dumps({"status": "installed", "release": str(release), "current": str(args.runtime_root / "current")}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
