#!/usr/bin/env python3
"""Run the feeds workflow with an explicit, fail-closed RAG dependency.

The normal engine keeps source and export stages in one process.  Feeds are
the one export path whose review graph also requires a freshly verified local
RAG context, so this entry point makes that dependency explicit without
enabling the unrelated analysis stage:

    sources(feeds) -> RAG sync/retrieval/verification -> export(feeds)

The RAG pipeline may update its index before discovering a bad context.  The
last-known-good context and sync status are therefore restored on any failed
handoff; the review graph remains fail-closed if the table itself changed.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Callable, Sequence


ROOT = Path(__file__).resolve().parents[3]
CONTEXT_PATH = ROOT / "FollowDaMO" / "knowledge" / "retrieval_context" / f"{dt.date.today().isoformat()}-lancedb-context.json"
RAG_STATUS_PATH = ROOT / "data" / "lancedb_sync_status.json"
RAG_LATEST_PATH = ROOT / "data" / "openclaw-rag" / "latest.json"


def run(command: list[str], *, cwd: Path | None = None, timeout: int = 3600) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, cwd=cwd or ROOT, capture_output=True, text=True, check=False, timeout=timeout)
    if result.returncode:
        output = (result.stderr or result.stdout or "command failed").strip().splitlines()
        raise RuntimeError(output[-1][:700] if output else f"command failed ({result.returncode})")
    return result


def engine_command(workflow_name: str, *, stage: str) -> list[str]:
    command = [
        sys.executable,
        "scripts/run_moneytrail_engine.py",
        "--mode",
        "frequent",
        "--stages",
        stage,
        "--require-stage-success",
        "--workflow-name",
        workflow_name,
    ]
    if stage == "sources":
        command.extend(["--source-groups", "feeds"])
    else:
        command.extend(["--export-sections", "feeds", "--require-export"])
    return command


def snapshot(paths: Sequence[Path]) -> dict[Path, bytes | None]:
    return {path: path.read_bytes() if path.exists() else None for path in paths}


def restore(snapshot_values: dict[Path, bytes | None]) -> None:
    for path, value in snapshot_values.items():
        if value is None:
            if path.exists():
                path.unlink()
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile("wb", dir=path.parent, prefix=f".{path.name}.", delete=False) as handle:
            handle.write(value)
            temporary = Path(handle.name)
        os.replace(temporary, path)


def verify_current_context() -> dict[str, Any]:
    scripts_dir = str(ROOT / "scripts")
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)
    from run_openclaw_review_graph import load_verified_rag  # noqa: PLC0415

    verified = load_verified_rag()
    return {"table_version": verified["table_version"], "asset_count": len(verified["assets"])}


def refresh_feeds(
    workflow_name: str,
    *,
    runner: Callable[..., subprocess.CompletedProcess[str]] = run,
    verifier: Callable[[], dict[str, Any]] = verify_current_context,
) -> dict[str, Any]:
    preserved = snapshot((CONTEXT_PATH, RAG_STATUS_PATH))
    source_name = f"{workflow_name}_sources"
    try:
        runner(engine_command(source_name, stage="sources"), timeout=1800)
        runner([sys.executable, "scripts/run_openclaw_rag_pipeline.py"], timeout=3600)
        rag = verifier()
    except Exception as exc:  # noqa: BLE001 - preserve LKG and report a concise blocker.
        restore(preserved)
        return {"status": "failed", "phase": "sources_or_rag", "error": str(exc)[:700]}

    try:
        runner(engine_command(workflow_name, stage="export"), timeout=1800)
    except Exception as exc:  # noqa: BLE001 - export freshness remains governed by the engine.
        return {"status": "failed", "phase": "export", "rag": rag, "error": str(exc)[:700]}
    return {"status": "completed", "rag": rag}


def main(argv: Sequence[str] | None = None) -> int:
    global ROOT, CONTEXT_PATH, RAG_STATUS_PATH, RAG_LATEST_PATH
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=ROOT)
    parser.add_argument("--workflow-name", default="moneytrail_feeds_refresh")
    args = parser.parse_args(argv)
    requested_root = args.workspace.expanduser().resolve()
    ROOT = requested_root
    CONTEXT_PATH = ROOT / "FollowDaMO" / "knowledge" / "retrieval_context" / f"{dt.date.today().isoformat()}-lancedb-context.json"
    RAG_STATUS_PATH = ROOT / "data" / "lancedb_sync_status.json"
    RAG_LATEST_PATH = ROOT / "data" / "openclaw-rag" / "latest.json"
    result = refresh_feeds(args.workflow_name)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["status"] == "completed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
