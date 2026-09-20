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


PROTECTED_RUNTIME_FILES = (
    "scripts/run_moneytrail_engine.py",
    "scripts/run_daily_equilibrium.py",
    "scripts/export_cockpit_to_supabase.py",
    "scripts/moneytrail_section_status.py",
    "scripts/legacy_crontab_guard.py",
    "scripts/lancedb_sync_kb.py",
    "scripts/run_openclaw_rag_pipeline.py",
    "scripts/run_openclaw_review_graph.py",
    "scripts/run_moneytrail_decision_surfaces.py",
    "scripts/ingest_telegram_channels_to_kb.py",
    "scripts/ingest_x_to_kb.py",
    "scripts/ingest_youtube_to_kb.py",
    "scripts/ingest_macro_data_sources.py",
    "intelligence/config/macro_data_sources.json",
    "scripts/build_regional_macro_scores.py",
    "scripts/ingest_13f_filings.py",
    "scripts/research_13f_holdings.py",
    "scripts/process_thesis_research_requests.py",
    "scripts/review_stale_trade_ideas.py",
    "scripts/rv_trade_memory.py",
    "FollowDaMO/scripts/run_followdamo_daily.py",
    "FollowDaMO/scripts/run_company_valuation_gate.py",
    "FollowDaMO/scripts/run_paper_trading.py",
    "FollowDaMO/scripts/build_trade_ideas.py",
    "FollowDaMO/scripts/retrieve_lancedb_context.py",
    "FollowDaMO/scripts/init_db.py",
    "FollowDaMO/runtime.py",
    "intelligence/llm/client.py",
    "intelligence/llm/runtime.py",
    "intelligence/llm/config.py",
    "intelligence/llm/reasoning_pipeline.py",
    "intelligence/llm/json_utils.py",
    "intelligence/llm/council_reasoner.py",
    "intelligence/llm/consensus_reasoner.py",
    "intelligence/llm/claim_refiner.py",
    "intelligence/llm/insight_scorer.py",
    "intelligence/llm/audit.py",
    "intelligence/llm/thesis_memory_updater.py",
    "intelligence/council/consensus_builder.py",
    "intelligence/council/persona_runner.py",
    "intelligence/council/topic_pack_builder.py",
    "intelligence/research/evidence_pack_builder.py",
    "intelligence/research/opportunity_scout.py",
    "intelligence/config/reasoning_runtime.json",
    "MoneyTrailDash/ops/openclaw/moneytrail_capacity_guard.py",
    "MoneyTrailDash/ops/openclaw/moneytrail_capacity_jobs.json",
    "MoneyTrailDash/ops/openclaw/moneytrail_stale_idea_lifecycle.py",
    "MoneyTrailDash/ops/openclaw/run_moneytrail_feeds_refresh.py",
)


def atomic_symlink(link: Path, target: Path) -> None:
    link.parent.mkdir(parents=True, exist_ok=True)
    temporary = link.with_name(f".{link.name}.tmp-{os.getpid()}")
    try:
        temporary.unlink(missing_ok=True)
        temporary.symlink_to(target)
        os.replace(temporary, link)
    finally:
        temporary.unlink(missing_ok=True)


def install(
    runtime_root: Path,
    commit: str,
    workspace: Path,
    dashboard: Path,
    release_id: str | None = None,
) -> Path:
    root_manifest = workspace / "ops" / "hermes" / "migrated_processes.json"
    root_runner = workspace / "ops" / "hermes" / "run_migrated_process.py"
    launcher = dashboard / "ops" / "openclaw" / "moneytrail_launcher.py"
    for path in (launcher, root_manifest, root_runner):
        if not path.is_file():
            raise SystemExit(f"required runtime source is missing: {path}")
    source_hashes = {}
    for relative in PROTECTED_RUNTIME_FILES:
        path = workspace / relative
        if not path.is_file():
            raise SystemExit(f"required pinned runtime source is missing: {path}")
        source_hashes[relative] = sha256(path)
    release = runtime_root / (release_id or commit)
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
        "source_sha256": source_hashes,
        "workspace_commit": subprocess.check_output(
            ["git", "-C", str(workspace), "rev-parse", "HEAD"], text=True
        ).strip(),
        "release_id": release.name,
        "workspace": str(workspace),
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
    parser.add_argument("--release-id", default=None)
    args = parser.parse_args()
    commit = args.source_commit or source_commit(args.dashboard_root)
    release = install(args.runtime_root, commit, args.workspace, args.dashboard_root, args.release_id)
    print(json.dumps({"status": "installed", "release": str(release), "current": str(args.runtime_root / "current")}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
