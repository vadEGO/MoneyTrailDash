#!/usr/bin/env python3
"""Soft-archive stale MoneyTrail ideas around a canonical OpenClaw run.

The lifecycle is deliberately reversible. Source records and scores remain in
Supabase; only ``deleted_at`` changes, which removes an idea from the public
action-board view. A later canonical export can reactivate the row when its
source evidence becomes current again.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Sequence


SCHEMA_VERSION = 2
RETIRE_AFTER_MISSED_WINDOWS = 3
MISSING_EVIDENCE_GRACE_DAYS = 30
PROTECTED_STATES = {"holding", "exiting"}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).isoformat()


def parse_datetime(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        # Python 3.9 accepts only three or six fractional digits. Supabase can
        # return any precision, so normalize the fraction before retrying.
        head, dot, tail = text.partition(".")
        if not dot:
            return None
        fraction, plus, offset = tail.partition("+")
        fraction = (fraction.split("-", 1)[0] + "000000")[:6]
        suffix = f"+{offset}" if plus else ""
        try:
            parsed = datetime.fromisoformat(f"{head}.{fraction}{suffix}")
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def retirement_decision(
    row: dict[str, Any],
    *,
    as_of: datetime | None = None,
) -> dict[str, Any]:
    """Return an auditable archive decision based only on source clocks."""
    now = (as_of or utc_now()).astimezone(timezone.utc)
    if bool(row.get("is_tracked")):
        return {"archive": False, "reason": "explicitly tracked", "eligible_at": None}
    state = str(row.get("action_state") or "research").lower()
    if state in PROTECTED_STATES:
        return {"archive": False, "reason": f"protected {state} state", "eligible_at": None}

    status = str(row.get("evidence_freshness_status") or "missing").lower()
    if status == "stale":
        sla_days = max(1.0, number(row.get("evidence_sla_days"), 14.0))
        age_days = max(0.0, number(row.get("evidence_age_days")))
        retirement_age = sla_days * (1 + RETIRE_AFTER_MISSED_WINDOWS)
        if age_days >= retirement_age:
            confirmed = parse_datetime(row.get("evidence_last_confirmed_at"))
            eligible_at = confirmed + timedelta(days=retirement_age) if confirmed else now
            return {
                "archive": True,
                "reason": f"evidence missed {RETIRE_AFTER_MISSED_WINDOWS} complete review windows",
                "eligible_at": iso(min(eligible_at, now)),
            }
        return {"archive": False, "reason": "inside retirement grace period", "eligible_at": None}

    if status == "missing":
        anchor = parse_datetime(row.get("discovered_at") or row.get("updated_at"))
        eligible_at = anchor + timedelta(days=MISSING_EVIDENCE_GRACE_DAYS) if anchor else None
        if eligible_at and eligible_at <= now:
            return {
                "archive": True,
                "reason": f"no dated source evidence after {MISSING_EVIDENCE_GRACE_DAYS} days",
                "eligible_at": iso(eligible_at),
            }
        return {"archive": False, "reason": "missing evidence inside grace period", "eligible_at": None}

    return {"archive": False, "reason": f"evidence is {status}", "eligible_at": None}


def load_env(path: Path | None = None) -> None:
    env_path = path or (Path.home() / ".openclaw" / ".env")
    if not env_path.exists():
        return
    for raw in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip().removeprefix("export ").strip(), value.strip().strip("\"'"))


class SupabaseRest:
    def __init__(self, url: str, key: str) -> None:
        self.url = url.rstrip("/") + "/rest/v1"
        self.headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    def request(
        self,
        method: str,
        table: str,
        *,
        query: dict[str, str] | None = None,
        payload: Any = None,
        prefer: str | None = None,
    ) -> Any:
        encoded = urllib.parse.urlencode(query or {}, safe=",().*:")
        url = f"{self.url}/{table}" + (f"?{encoded}" if encoded else "")
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = dict(self.headers)
        if body is not None:
            headers["Content-Type"] = "application/json"
        if prefer:
            headers["Prefer"] = prefer
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                raw = response.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")[:500]
            raise RuntimeError(f"Supabase {method} {table} failed ({exc.code}): {detail}") from exc
        return json.loads(raw) if raw else None

    def opportunities(self) -> list[dict[str, Any]]:
        select = (
            "id,symbol,normalized_symbol,direction,action_state,is_tracked,is_watchlisted,expires_at,"
            "deleted_at,discovered_at,updated_at,"
            "evidence_last_confirmed_at,evidence_freshness_status,evidence_age_days,evidence_sla_days,"
            "price_freshness_status,levels_freshness_status,review_last_checked_at,review_freshness_status,"
            "review_status,actionability_status,lifecycle_status,soft_archived_at,closed_at,lifecycle_reason,"
            "lifecycle_last_reviewed_at,lifecycle_managed_by,lifecycle_policy_version"
        )
        rows: list[dict[str, Any]] = []
        page_size = 1000
        for offset in range(0, 10_000, page_size):
            page = self.request(
                "GET",
                "investment_opportunities",
                query={"select": select, "limit": str(page_size), "offset": str(offset), "order": "id.asc"},
            ) or []
            rows.extend(item for item in page if isinstance(item, dict))
            if len(page) < page_size:
                break
        return rows

    def patch_ids(self, ids: list[str], payload: dict[str, Any]) -> None:
        for offset in range(0, len(ids), 100):
            batch = ids[offset : offset + 100]
            self.request(
                "PATCH",
                "investment_opportunities",
                query={"id": "in.(" + ",".join(batch) + ")"},
                payload=payload,
                prefer="return=minimal",
            )

    def upsert_events(self, events: list[dict[str, Any]]) -> None:
        if events:
            self.request(
                "POST",
                "opportunity_engine_events",
                query={"on_conflict": "id"},
                payload=events,
                prefer="resolution=merge-duplicates,return=minimal",
            )


def read_state(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {"schema_version": SCHEMA_VERSION, "archived": {}}
    return payload if isinstance(payload, dict) else {"schema_version": SCHEMA_VERSION, "archived": {}}


def atomic_write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def event_id(kind: str, opportunity_id: str, marker: str) -> str:
    digest = hashlib.sha256(f"{kind}:{opportunity_id}:{marker}".encode("utf-8")).hexdigest()[:24]
    return f"openclaw-{kind}:{digest}"


def lifecycle_event(
    row: dict[str, Any],
    *,
    kind: str,
    at: str,
    reason: str,
) -> dict[str, Any]:
    symbol = row.get("normalized_symbol") or row.get("symbol") or "UNKNOWN"
    archived = kind == "stale-idea-archived"
    return {
        "id": event_id(kind, str(row["id"]), at),
        "opportunity_id": row["id"],
        "event_type": kind.replace("-", "_"),
        "action_state": "research",
        "symbol": symbol,
        "title": f"{symbol} {'archived' if archived else 'reactivated'} by OpenClaw",
        "detail": (
            f"Soft-archived after deterministic source-SLA review: {reason}."
            if archived
            else "Restored after current source evidence passed the lifecycle gate."
        ),
        "event_at": at,
        "sync_batch_id": None,
    }


def review_failures(row: dict[str, Any]) -> list[str]:
    clocks = {
        "evidence": str(row.get("evidence_freshness_status") or "missing").lower(),
        "price": str(row.get("price_freshness_status") or "missing").lower(),
        "levels": str(row.get("levels_freshness_status") or "missing").lower(),
    }
    failures = [name for name, status in clocks.items() if status != "fresh"]
    if str(row.get("direction") or "").lower() == "mixed":
        failures.append("direction")
    return failures


def review_event(row: dict[str, Any], *, at: str, failures: list[str]) -> dict[str, Any]:
    symbol = row.get("normalized_symbol") or row.get("symbol") or "UNKNOWN"
    return {
        "id": "openclaw-review:" + hashlib.sha256(str(row["id"]).encode("utf-8")).hexdigest()[:24],
        "opportunity_id": row["id"],
        "event_type": "openclaw_trade_idea_review",
        "action_state": "research",
        "symbol": symbol,
        "title": f"{symbol} OpenClaw review",
        "detail": (
            f"OpenClaw review completed; refresh required for {', '.join(failures)}."
            if failures
            else "OpenClaw review completed; all source, price, and level clocks are current."
        ),
        "event_at": at,
        "sync_batch_id": None,
    }


def apply_lifecycle(
    client: SupabaseRest,
    state_path: Path,
    *,
    dry_run: bool = False,
    as_of: datetime | None = None,
) -> dict[str, Any]:
    now = (as_of or utc_now()).astimezone(timezone.utc)
    now_text = iso(now)
    previous = read_state(state_path)
    previous_archived = previous.get("archived") if isinstance(previous.get("archived"), dict) else {}
    all_rows = [row for row in client.opportunities() if isinstance(row, dict) and row.get("id")]
    # Ignore legacy/superseded deletions that this lifecycle does not own.
    # Rows recorded in our state remain in scope so they can be reactivated.
    rows = [
        row for row in all_rows
        if not row.get("deleted_at") or str(row["id"]) in previous_archived
    ]
    by_id = {str(row["id"]): row for row in rows}
    decisions = {row_id: retirement_decision(row, as_of=now) for row_id, row in by_id.items()}

    new_ids = [
        row_id for row_id, decision in decisions.items()
        if decision["archive"] and not by_id[row_id].get("deleted_at") and row_id not in previous_archived
    ]
    rearchive: dict[str, list[str]] = {}
    for row_id, archived in previous_archived.items():
        if row_id in decisions and decisions[row_id]["archive"] and not by_id[row_id].get("deleted_at"):
            marker = str((archived or {}).get("archived_at") or now_text)
            rearchive.setdefault(marker, []).append(row_id)
    reactivated = [
        row_id for row_id in previous_archived
        if row_id in decisions and not decisions[row_id]["archive"]
    ]

    events: list[dict[str, Any]] = []
    for row_id in new_ids:
        events.append(lifecycle_event(by_id[row_id], kind="stale-idea-archived", at=now_text, reason=decisions[row_id]["reason"]))
    for row_id in reactivated:
        events.append(lifecycle_event(by_id[row_id], kind="stale-idea-reactivated", at=now_text, reason=decisions[row_id]["reason"]))

    review_groups: dict[tuple[str, str, str, str], list[str]] = {}
    review_queue_count = 0
    current_count = 0
    for row_id, row in by_id.items():
        if decisions[row_id]["archive"]:
            continue
        failures = review_failures(row)
        if failures:
            review_queue_count += 1
            review_status = "pending_revalidation"
            actionability_status = "quarantined"
            next_action = "Refresh required for: " + ", ".join(failures) + "."
            reason = "OpenClaw review completed; the idea remains in the re-evaluation queue."
        else:
            current_count += 1
            review_status = "checked"
            actionability_status = "review_required"
            next_action = "All source clocks are current; continue monitoring until the next review cycle."
            reason = "OpenClaw review completed; the idea is current and research-only."
        review_groups.setdefault((review_status, actionability_status, next_action, reason), []).append(row_id)
        events.append(review_event(row, at=now_text, failures=failures))

    if not dry_run:
        if new_ids:
            client.patch_ids(
                new_ids,
                {
                    "deleted_at": now_text,
                    "soft_archived_at": now_text,
                    "closed_at": None,
                    "lifecycle_status": "soft_archived",
                    "lifecycle_reason": "deterministic source-SLA retirement",
                    "lifecycle_managed_by": "openclaw_stale_lifecycle",
                    "lifecycle_policy_version": SCHEMA_VERSION,
                },
            )
        for marker, ids in rearchive.items():
            client.patch_ids(
                ids,
                {
                    "deleted_at": marker,
                    "soft_archived_at": marker,
                    "lifecycle_status": "soft_archived",
                    "lifecycle_managed_by": "openclaw_stale_lifecycle",
                    "lifecycle_policy_version": SCHEMA_VERSION,
                },
            )
        # A canonical export may already clear deleted_at before this pass. We
        # still normalize the explicit lifecycle columns for every reactivated
        # row so the data contract cannot remain split-brain.
        restore_ids = list(reactivated)
        if restore_ids:
            client.patch_ids(
                restore_ids,
                {
                    "deleted_at": None,
                    "soft_archived_at": None,
                    "closed_at": None,
                    "lifecycle_status": "active",
                    "lifecycle_reason": "fresh evidence restored by OpenClaw",
                    "lifecycle_managed_by": "openclaw_stale_lifecycle",
                    "lifecycle_policy_version": SCHEMA_VERSION,
                },
            )
        for (review_status, actionability_status, next_action, reason), ids in review_groups.items():
            client.patch_ids(
                ids,
                {
                    "review_last_checked_at": now_text,
                    "review_freshness_status": "fresh",
                    "review_status": review_status,
                    "review_next_action": next_action,
                    "actionability_status": actionability_status,
                    "actionability_reason": reason,
                },
            )
        client.upsert_events(events)

    archived_state: dict[str, dict[str, Any]] = {}
    for row_id, decision in decisions.items():
        if not decision["archive"]:
            continue
        old = previous_archived.get(row_id) if isinstance(previous_archived.get(row_id), dict) else {}
        if row_id in new_ids or row_id in previous_archived:
            archived_state[row_id] = {
                "archived_at": old.get("archived_at") or now_text,
                "eligible_at": decision.get("eligible_at"),
                "reason": decision["reason"],
            }

    summary = {
        "status": "dry_run" if dry_run else "success",
        "checked_at": now_text,
        "rows_checked": len(rows),
        "eligible": sum(bool(item["archive"]) for item in decisions.values()),
        "newly_archived": len(new_ids),
        "rearchived_after_export": sum(len(ids) for ids in rearchive.values()),
        "reactivated": len(reactivated),
        "visible_after": len(rows) - sum(bool(item["archive"]) for item in decisions.values()),
        "current_count": current_count,
        "review_queue_count": review_queue_count,
        "policy": {
            "retire_after_missed_windows": RETIRE_AFTER_MISSED_WINDOWS,
            "missing_evidence_grace_days": MISSING_EVIDENCE_GRACE_DAYS,
            "protected_states": sorted(PROTECTED_STATES),
            "tracked_rows_protected": True,
            "hard_delete": False,
        },
    }
    if not dry_run:
        atomic_write(
            state_path,
            {
                "schema_version": SCHEMA_VERSION,
                "updated_at": now_text,
                "archived": archived_state,
                "last_success": summary,
            },
        )
    return summary


def create_client() -> SupabaseRest:
    load_env()
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Supabase runtime configuration is unavailable")
    return SupabaseRest(url, key)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--workflow-name", required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)
    command = list(args.command)
    if command and command[0] == "--":
        command = command[1:]
    state_path = args.workspace / "data/moneytrail-engine/stale_idea_lifecycle_state.json"
    client = create_client()

    before = apply_lifecycle(client, state_path, dry_run=args.dry_run)
    if args.dry_run:
        print(json.dumps({"workflow_name": args.workflow_name, "before": before}, indent=2, sort_keys=True))
        return 0
    if not command:
        print(json.dumps({"workflow_name": args.workflow_name, "before": before}, indent=2, sort_keys=True))
        return 0

    completed = subprocess.run(command, cwd=args.workspace)
    if completed.returncode != 0:
        print(json.dumps({"workflow_name": args.workflow_name, "before": before, "command_returncode": completed.returncode}, indent=2, sort_keys=True))
        return completed.returncode

    try:
        after = apply_lifecycle(client, state_path)
    except Exception as exc:  # fail closed; the prior archive pass remains active
        print(json.dumps({"status": "failed", "workflow_name": args.workflow_name, "error": str(exc)[:500]}, indent=2, sort_keys=True))
        return 1
    print(json.dumps({"status": "success", "workflow_name": args.workflow_name, "before": before, "after": after}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
