import importlib.util
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "moneytrail_stale_idea_lifecycle.py"
SPEC = importlib.util.spec_from_file_location("moneytrail_stale_idea_lifecycle", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


NOW = datetime(2026, 8, 13, tzinfo=timezone.utc)


def row(identifier, **overrides):
    value = {
        "id": identifier,
        "symbol": identifier.upper(),
        "action_state": "ready",
        "is_tracked": False,
        "deleted_at": None,
        "discovered_at": "2026-01-01T00:00:00Z",
        "evidence_last_confirmed_at": "2026-05-01T00:00:00Z",
        "evidence_freshness_status": "stale",
        "evidence_age_days": 104,
        "evidence_sla_days": 14,
        "price_freshness_status": "fresh",
        "levels_freshness_status": "missing",
    }
    value.update(overrides)
    return value


class FakeClient:
    def __init__(self, rows):
        self.rows = rows
        self.patches = []
        self.events = []

    def opportunities(self):
        return self.rows

    def patch_ids(self, ids, payload):
        self.patches.append((ids, payload))
        for item in self.rows:
            if item["id"] in ids:
                item.update(payload)

    def upsert_events(self, events):
        self.events.extend(events)


class StaleIdeaLifecycleTests(unittest.TestCase):
    def test_archives_only_after_three_complete_missed_windows(self):
        self.assertTrue(MODULE.retirement_decision(row("old"), as_of=NOW)["archive"])
        self.assertFalse(MODULE.retirement_decision(row("grace", evidence_age_days=55), as_of=NOW)["archive"])

    def test_tracked_and_holding_rows_are_protected(self):
        self.assertFalse(MODULE.retirement_decision(row("tracked", is_tracked=True), as_of=NOW)["archive"])
        self.assertFalse(MODULE.retirement_decision(row("held", action_state="holding"), as_of=NOW)["archive"])

    def test_missing_evidence_uses_thirty_day_grace(self):
        old = row("missing-old", evidence_freshness_status="missing", evidence_age_days=None)
        recent = row("missing-new", evidence_freshness_status="missing", evidence_age_days=None, discovered_at="2026-08-01T00:00:00Z")
        self.assertTrue(MODULE.retirement_decision(old, as_of=NOW)["archive"])
        self.assertFalse(MODULE.retirement_decision(recent, as_of=NOW)["archive"])

    def test_soft_archive_and_reactivation_are_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            client = FakeClient([
                row("old"),
                row("current", evidence_freshness_status="fresh", levels_freshness_status="fresh"),
            ])
            first = MODULE.apply_lifecycle(client, state, as_of=NOW)
            self.assertEqual(first["newly_archived"], 1)
            self.assertEqual(first["current_count"], 1)
            self.assertIsNotNone(client.rows[0]["deleted_at"])
            self.assertTrue(any(event["event_type"] == "stale_idea_archived" for event in client.events))

            # A canonical export writes the same stable row as current and clears
            # deleted_at. The next lifecycle pass restores it once, with audit.
            client.rows[0].update({"deleted_at": None, "evidence_freshness_status": "fresh", "levels_freshness_status": "fresh"})
            second = MODULE.apply_lifecycle(client, state, as_of=NOW)
            self.assertEqual(second["reactivated"], 1)
            self.assertEqual(second["current_count"], 2)
            self.assertIsNone(client.rows[0]["deleted_at"])
            self.assertTrue(any(event["event_type"] == "stale_idea_reactivated" for event in client.events))


if __name__ == "__main__":
    unittest.main()
