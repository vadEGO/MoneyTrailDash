import importlib.util
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path


OPS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(OPS))
MODULE_PATH = OPS / "moneytrail_monthly_archive_review.py"
SPEC = importlib.util.spec_from_file_location("moneytrail_monthly_archive_review", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


NOW = datetime(2026, 10, 4, tzinfo=timezone.utc)


def row(identifier, **overrides):
    value = {
        "id": identifier,
        "symbol": identifier.upper(),
        "action_state": "ready",
        "is_tracked": False,
        "is_watchlisted": False,
        "deleted_at": "2026-06-01T00:00:00Z",
        "soft_archived_at": "2026-06-01T00:00:00Z",
        "lifecycle_status": "soft_archived",
        "evidence_last_confirmed_at": "2026-05-01T00:00:00Z",
        "evidence_freshness_status": "stale",
        "expires_at": None,
    }
    value.update(overrides)
    return value


class FakeClient:
    def __init__(self, rows, allocations=None):
        self.rows = rows
        self.allocations = allocations or []
        self.patches = []
        self.events = []
        self.transitions = []

    def opportunities(self):
        return self.rows

    def request(self, method, table, **kwargs):
        self.assert_request = (method, table, kwargs)
        return self.allocations

    def patch_ids(self, ids, payload):
        self.patches.append((ids, payload))
        for item in self.rows:
            if item["id"] in ids:
                item.update(payload)

    def upsert_events(self, events):
        self.events.extend(events)

    def apply_lifecycle_transitions(self, transitions, *, reviewed_at, policy_version):
        self.transitions.extend(transitions)
        for transition in transitions:
            for item in self.rows:
                if item["id"] == transition["opportunity_id"]:
                    item.update({
                        "lifecycle_status": transition["lifecycle_status"],
                        "deleted_at": transition["deleted_at"],
                        "soft_archived_at": transition["soft_archived_at"],
                        "closed_at": transition["closed_at"],
                    })
        return {"updated": len(transitions), "events_inserted": sum(bool(item.get("event_id")) for item in transitions)}


class MonthlyArchiveReviewTests(unittest.TestCase):
    def test_closes_only_after_ninety_days(self):
        self.assertEqual(MODULE.closure_decision(row("old"), as_of=NOW)["action"], "close")
        recent = row("recent", deleted_at="2026-09-01T00:00:00Z", soft_archived_at="2026-09-01T00:00:00Z")
        self.assertEqual(MODULE.closure_decision(recent, as_of=NOW)["action"], "protect")

    def test_protects_user_and_portfolio_relevance(self):
        self.assertEqual(MODULE.closure_decision(row("tracked", is_tracked=True), as_of=NOW)["action"], "protect")
        self.assertEqual(MODULE.closure_decision(row("watch", is_watchlisted=True), as_of=NOW)["action"], "protect")
        self.assertEqual(MODULE.closure_decision(row("held", action_state="holding"), as_of=NOW)["action"], "protect")
        self.assertEqual(MODULE.closure_decision(row("btc"), portfolio_symbols={"BTC"}, as_of=NOW)["action"], "protect")

    def test_fresh_evidence_after_archive_reopens(self):
        candidate = row(
            "fresh",
            evidence_last_confirmed_at="2026-08-01T00:00:00Z",
            evidence_freshness_status="fresh",
        )
        self.assertEqual(MODULE.closure_decision(candidate, as_of=NOW)["action"], "reopen")

    def test_first_two_distinct_periods_are_report_only_then_apply(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            client = FakeClient([row("old")])
            august = MODULE.apply_monthly_review(client, state, as_of=datetime(2026, 8, 2, tzinfo=timezone.utc))
            september = MODULE.apply_monthly_review(client, state, as_of=datetime(2026, 9, 6, tzinfo=timezone.utc))
            october = MODULE.apply_monthly_review(client, state, as_of=NOW)
            self.assertTrue(august["report_only"])
            self.assertTrue(september["report_only"])
            self.assertFalse(october["report_only"])
            self.assertEqual(october["closed"], 1)
            self.assertEqual(client.rows[0]["lifecycle_status"], "closed")
            self.assertEqual(october["hard_deleted"], 0)

    def test_same_period_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            client = FakeClient([row("old")])
            first = MODULE.apply_monthly_review(client, state, as_of=NOW)
            second = MODULE.apply_monthly_review(client, state, as_of=NOW)
            self.assertEqual(first["status"], "report_only")
            self.assertEqual(second["status"], "report_only")
            self.assertFalse(second["new_period"])
            self.assertEqual(client.patches, [])

    def test_scheduled_guard_runs_only_first_sunday(self):
        self.assertTrue(MODULE.first_sunday(datetime(2026, 10, 4, tzinfo=timezone.utc)))
        self.assertFalse(MODULE.first_sunday(datetime(2026, 10, 11, tzinfo=timezone.utc)))

    def test_reads_public_portfolio_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            client = FakeClient([row("btc")], allocations=[{"symbol": "BTC", "action": "hold", "target_pct": 1}])
            result = MODULE.apply_monthly_review(client, state, as_of=NOW)
            self.assertEqual(client.assert_request[1], "public_portfolio_proposal")
            self.assertEqual(result["decision_counts"]["protect"], 1)


if __name__ == "__main__":
    unittest.main()
