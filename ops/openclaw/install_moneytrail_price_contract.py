#!/usr/bin/env python3
"""Install and verify the versioned MoneyTrail market-price consolidation fix."""

from __future__ import annotations

import argparse
import os
from pathlib import Path
import tempfile


OLD_CONSOLIDATION = '''    level_fields = (
        "current_price", "ideal_entry", "entry_min", "entry_max",
        "do_not_chase_above", "stop_loss", "take_profit_1", "take_profit_2", "take_profit_3",
    )

    for group_key, members in grouped.items():'''

NEW_CONSOLIDATION = '''    # Market price has its own source and freshness clock. Never let the
    # selected trade-level owner overwrite a fresh quote with a stale or null
    # source-level value.
    level_fields = (
        "ideal_entry", "entry_min", "entry_max",
        "do_not_chase_above", "stop_loss", "take_profit_1", "take_profit_2", "take_profit_3",
    )

    for group_key, members in grouped.items():'''

OLD_QUARANTINE = '''def quarantine_stale_remote_levels(client: SupabaseRest) -> int:
    """Clear raw price/level fields on legacy stale rows as a second safety net."""
    if not hasattr(client, "_request"):
        return 0
    level_fields = (
        "current_price", "ideal_entry", "entry_min", "entry_max",
        "do_not_chase_above", "stop_loss", "take_profit_1", "take_profit_2", "take_profit_3",
    )
    remote_rows = client._request(
        "GET",
        "investment_opportunities",
        query={
            "select": "id,evidence_freshness_status," + ",".join(level_fields),
            "deleted_at": "is.null",
            "evidence_freshness_status": "in.(stale,missing)",'''

NEW_QUARANTINE = '''def quarantine_stale_remote_levels(client: SupabaseRest) -> int:
    """Clear stale trade levels without erasing an independently fresh quote."""
    if not hasattr(client, "_request"):
        return 0
    level_fields = (
        "ideal_entry", "entry_min", "entry_max",
        "do_not_chase_above", "stop_loss", "take_profit_1", "take_profit_2", "take_profit_3",
    )
    remote_rows = client._request(
        "GET",
        "investment_opportunities",
        query={
            "select": "id,levels_freshness_status," + ",".join(level_fields),
            "deleted_at": "is.null",
            "levels_freshness_status": "in.(stale,missing)",'''

TRANSFORMS = (
    (OLD_CONSOLIDATION, NEW_CONSOLIDATION),
    (OLD_QUARANTINE, NEW_QUARANTINE),
)


def transform(source: str) -> tuple[str, bool]:
    """Return the fixed exporter source and whether it changed."""
    changed = False
    for old, new in TRANSFORMS:
        if new in source and old not in source:
            continue
        if source.count(old) != 1:
            raise RuntimeError("Exporter price-contract anchor is missing or ambiguous")
        source = source.replace(old, new, 1)
        changed = True
    return source, changed


def exporter_path(workspace: Path) -> Path:
    return workspace / "scripts" / "export_cockpit_to_supabase.py"


def verify(path: Path) -> None:
    source = path.read_text(encoding="utf-8")
    for old, new in TRANSFORMS:
        if new not in source or old in source:
            raise RuntimeError(f"MoneyTrail price contract is not installed at {path}")


def install(path: Path) -> bool:
    source = path.read_text(encoding="utf-8")
    updated, changed = transform(source)
    if not changed:
        return False
    mode = path.stat().st_mode
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=path.parent,
        prefix=f".{path.name}.",
        delete=False,
    ) as handle:
        handle.write(updated)
        temporary = Path(handle.name)
    os.chmod(temporary, mode)
    os.replace(temporary, path)
    verify(path)
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--workspace",
        type=Path,
        default=Path("/Users/vaddylandbot/.openclaw/workspace"),
    )
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()

    path = exporter_path(args.workspace.resolve())
    changed = install(path) if args.apply else False
    verify(path)
    print(f"MoneyTrail price contract verified at {path} (changed={str(changed).lower()})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
