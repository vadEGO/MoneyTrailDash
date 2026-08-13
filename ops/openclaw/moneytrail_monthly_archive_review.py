#!/usr/bin/env python3
"""Review MoneyTrail soft archives monthly and close inert records safely.

The first two distinct Sydney calendar-month cohorts are report-only. Later
cohorts may mark eligible rows ``closed`` while retaining every database row,
source reference, score, and audit event. Fresh evidence can reopen a closed
row through the normal stale-idea lifecycle.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Sequence
from zoneinfo import ZoneInfo

from moneytrail_stale_idea_lifecycle import (
    SCHEMA_VERSION,
    SupabaseRest,
    atomic_write,
    create_client,
    iso,
    parse_datetime,
    utc_now,
)


SYDNEY = ZoneInfo("Australia/Sydney")
CLOSE_AFTER_DAYS = 90
REPORT_ONLY_PERIODS = 2
PROTECTED_STATES = {"holding", "exiting"}
ACTIVE_PORTFOLIO_ACTIONS = {"buy", "add", "increase", "hold", "maintain"}


def normalized_symbol(row: dict[str, Any]) -> str:
    value = str(row.get("normalized_symbol") or row.get("symbol") or "").upper().strip()
    if ":" in value:
        value = value.split(":", 1)[1]
    for suffix in ("USDT", "USDC", "USD"):
        if value.endswith(suffix) and len(value) > len(suffix):
            value = value[: -len(suffix)]
            break
    return value


def first_sunday(value: datetime) -> bool:
    local = value.astimezone(SYDNEY)
    return local.weekday() == 6 and local.day <= 7


def review_period(value: datetime) -> str:
    return value.astimezone(SYDNEY).strftime("%Y-%m")


def closure_decision(
    row: dict[str, Any],
    *,
    portfolio_symbols: set[str] | None = None,
    as_of: datetime | None = None,
) -> dict[str, Any]:
    now = (as_of or utc_now()).astimezone(timezone.utc)
    status = str(row.get("lifecycle_status") or ("soft_archived" if row.get("deleted_at") else "active"))
    if status == "closed":
        return {"action": "none", "reason": "already closed", "eligible_at": None}
    if status != "soft_archived" or not row.get("deleted_at"):
        return {"action": "none", "reason": "not soft archived", "eligible_at": None}

    archived_at = parse_datetime(row.get("soft_archived_at") or row.get("deleted_at"))
    if not archived_at:
        return {"action": "protect", "reason": "archive clock missing", "eligible_at": None}

    if bool(row.get("is_tracked")):
        return {"action": "protect", "reason": "explicitly tracked", "eligible_at": None}
    if bool(row.get("is_watchlisted")):
        return {"action": "protect", "reason": "watchlisted", "eligible_at": None}
    state = str(row.get("action_state") or "research").lower()
    if state in PROTECTED_STATES:
        return {"action": "protect", "reason": f"protected {state} state", "eligible_at": None}

    expires_at = parse_datetime(row.get("expires_at"))
    if expires_at and expires_at > now:
        return {"action": "protect", "reason": "decision horizon or catalyst is upcoming", "eligible_at": None}

    symbol = normalized_symbol(row)
    if symbol and symbol in (portfolio_symbols or set()):
        return {"action": "protect", "reason": "active portfolio allocation", "eligible_at": None}

    confirmed_at = parse_datetime(row.get("evidence_last_confirmed_at"))
    evidence_status = str(row.get("evidence_freshness_status") or "missing").lower()
    if confirmed_at and confirmed_at > archived_at and evidence_status in {"fresh", "aging"}:
        return {"action": "reopen", "reason": "fresh evidence arrived after archive", "eligible_at": None}

    eligible_at = archived_at + timedelta(days=CLOSE_AFTER_DAYS)
    if eligible_at > now:
        return {"action": "protect", "reason": "inside closure observation window", "eligible_at": iso(eligible_at)}
    return {
        "action": "close",
        "reason": f"no fresh evidence or protected decision after {CLOSE_AFTER_DAYS} days",
        "eligible_at": iso(eligible_at),
    }


def lifecycle_event(row: dict[str, Any], *, kind: str, at: str, reason: str) -> dict[str, Any]:
    opportunity_id = str(row["id"])
    marker = hashlib.sha256(f"{kind}:{opportunity_id}:{at}".encode("utf-8")).hexdigest()[:24]
    symbol = normalized_symbol(row) or "UNKNOWN"
    return {
        "id": f"openclaw-{kind}:{marker}",
        "opportunity_id": opportunity_id,
        "event_type": kind.replace("-", "_"),
        "action_state": "research",
        "symbol": symbol,
        "title": f"{symbol} {'closed' if kind == 'soft-archive-closed' else 'reopened'} by OpenClaw",
        "detail": reason,
        "event_at": at,
        "sync_batch_id": None,
    }


def portfolio_symbols(client: SupabaseRest) -> set[str]:
    rows = client.request(
        "GET",
        "public_portfolio_proposal",
        query={"select": "symbol,action,target_pct,proposed_at", "limit": "5000", "order": "proposed_at.desc"},
    ) or []
    latest: dict[str, dict[str, Any]] = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        symbol = normalized_symbol(row)
        if symbol and symbol not in latest:
            latest[symbol] = row
    protected: set[str] = set()
    for symbol, row in latest.items():
        action = str(row.get("action") or "").lower()
        try:
            target = float(row.get("target_pct") or 0)
        except (TypeError, ValueError):
            target = 0
        if target > 0 or action in ACTIVE_PORTFOLIO_ACTIONS:
            protected.add(symbol)
    return protected


def apply_monthly_review(
    client: SupabaseRest,
    state_path: Path,
    *,
    as_of: datetime | None = None,
    dry_run: bool = False,
    require_first_sunday: bool = False,
) -> dict[str, Any]:
    now = (as_of or utc_now()).astimezone(timezone.utc)
    now_text = iso(now)
    period = review_period(now)
    if require_first_sunday and not first_sunday(now):
        return {"status": "not_due", "checked_at": now_text, "period": period}

    from moneytrail_stale_idea_lifecycle import read_state

    previous = read_state(state_path)
    periods = list(dict.fromkeys(str(item) for item in previous.get("review_periods", []) if item))
    is_new_period = period not in periods
    effective_periods = periods + ([period] if is_new_period else [])
    report_only = len(effective_periods) <= REPORT_ONLY_PERIODS

    rows = [row for row in client.opportunities() if isinstance(row, dict) and row.get("id")]
    allocations = portfolio_symbols(client)
    decisions = {
        str(row["id"]): closure_decision(row, portfolio_symbols=allocations, as_of=now)
        for row in rows
    }
    by_id = {str(row["id"]): row for row in rows}
    close_ids = [row_id for row_id, decision in decisions.items() if decision["action"] == "close"]
    reopen_ids = [row_id for row_id, decision in decisions.items() if decision["action"] == "reopen"]
    should_apply = is_new_period and not report_only and not dry_run

    events: list[dict[str, Any]] = []
    if should_apply:
        for row_id in close_ids:
            events.append(lifecycle_event(by_id[row_id], kind="soft-archive-closed", at=now_text, reason=decisions[row_id]["reason"]))
        for row_id in reopen_ids:
            events.append(lifecycle_event(by_id[row_id], kind="soft-archive-reopened", at=now_text, reason=decisions[row_id]["reason"]))
        events_by_opportunity = {str(event["opportunity_id"]): event for event in events}
        transitions: list[dict[str, Any]] = []
        for row_id, decision in decisions.items():
            if decision["action"] not in {"protect", "close", "reopen"}:
                continue
            row = by_id[row_id]
            event = events_by_opportunity.get(row_id, {})
            action = str(decision["action"])
            transitions.append({
                "opportunity_id": row_id,
                "lifecycle_status": "closed" if action == "close" else ("active" if action == "reopen" else "soft_archived"),
                "deleted_at": None if action == "reopen" else row.get("deleted_at"),
                "soft_archived_at": None if action == "reopen" else (row.get("soft_archived_at") or row.get("deleted_at")),
                "closed_at": now_text if action == "close" else (None if action == "reopen" else row.get("closed_at")),
                "reason": (
                    f"monthly policy protected: {decision['reason']}"
                    if action == "protect" else f"monthly policy: {decision['reason']}"
                ),
                "managed_by": "openclaw_monthly_archive_review",
                "event_id": event.get("id"),
                "event_type": event.get("event_type"),
                "action_state": event.get("action_state"),
                "symbol": event.get("symbol"),
                "title": event.get("title"),
                "detail": event.get("detail"),
            })
        client.apply_lifecycle_transitions(
            transitions,
            reviewed_at=now_text,
            policy_version=SCHEMA_VERSION,
        )

    counts: dict[str, int] = {}
    for decision in decisions.values():
        action = str(decision["action"])
        counts[action] = counts.get(action, 0) + 1
    summary = {
        "status": "dry_run" if dry_run else ("report_only" if report_only else ("success" if is_new_period else "already_reviewed")),
        "checked_at": now_text,
        "period": period,
        "new_period": is_new_period,
        "report_only": report_only,
        "report_period_number": effective_periods.index(period) + 1,
        "rows_checked": len(rows),
        "decision_counts": counts,
        "proposed_close": len(close_ids),
        "proposed_reopen": len(reopen_ids),
        "closed": len(close_ids) if should_apply else 0,
        "reopened": len(reopen_ids) if should_apply else 0,
        "reviewed_in_supabase": (
            counts.get("protect", 0) + len(close_ids) + len(reopen_ids)
            if should_apply else 0
        ),
        "hard_deleted": 0,
        "active_portfolio_symbols": len(allocations),
        "policy": {
            "close_after_days": CLOSE_AFTER_DAYS,
            "report_only_periods": REPORT_ONLY_PERIODS,
            "protected_states": sorted(PROTECTED_STATES),
            "tracked_watchlisted_protected": True,
            "future_decision_horizon_protected": True,
            "fresh_evidence_reopens": True,
            "hard_delete": False,
        },
    }
    if not dry_run and is_new_period:
        atomic_write(state_path, {
            "schema_version": SCHEMA_VERSION,
            "updated_at": now_text,
            "review_periods": effective_periods,
            "latest_report": summary,
        })
    return summary


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--require-first-sunday", action="store_true")
    args = parser.parse_args(argv)
    state_path = args.workspace / "data/moneytrail-engine/monthly_archive_review_state.json"
    result = apply_monthly_review(
        create_client(),
        state_path,
        dry_run=args.dry_run,
        require_first_sunday=args.require_first_sunday,
    )
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
