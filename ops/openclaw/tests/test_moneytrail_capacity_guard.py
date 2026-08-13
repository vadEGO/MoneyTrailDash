from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).resolve().parents[1] / "moneytrail_capacity_guard.py"
SPEC = importlib.util.spec_from_file_location("moneytrail_capacity_guard", MODULE_PATH)
assert SPEC and SPEC.loader
guard = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guard)


class CapacityGuardTest(unittest.TestCase):
    def test_capacity_reserve_accounts_for_peak_write_amplification(self) -> None:
        result = guard.evaluate_capacity(
            {
                "free_bytes": 7_999,
                "free_percent": 50.0,
                "free_inodes": 100,
            },
            minimum_free_bytes=1_000,
            minimum_free_percent=5.0,
            expected_peak_write_bytes=4_000,
            reserve_multiplier=2.0,
        )
        self.assertEqual("blocked_capacity", result["status"])
        self.assertEqual(8_000, result["required_free_bytes"])
        self.assertIn("free_bytes_below_required_reserve", result["reasons"])

    def test_failed_event_preserves_last_known_good(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            state_path = Path(directory) / "capacity.json"
            guard.persist_state(state_path, {"status": "success", "run": "good"})
            guard.persist_state(state_path, {"status": "command_failed", "run": "bad"})
            payload = json.loads(state_path.read_text())
            self.assertEqual("bad", payload["current"]["run"])
            self.assertEqual("good", payload["last_success"]["run"])

    def test_low_capacity_never_starts_command(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            args = guard.parser().parse_args(
                [
                    "--workspace",
                    str(workspace),
                    "--workflow-name",
                    "test",
                    "--minimum-free-bytes",
                    str(10**18),
                    "--",
                    sys.executable,
                    "-c",
                    "raise SystemExit(99)",
                ]
            )
            args.command = args.command[1:]
            with patch.object(guard.subprocess, "run") as run:
                self.assertEqual(guard.CAPACITY_EXIT_CODE, guard.run_guarded(args))
                run.assert_not_called()

    def test_successful_command_advances_last_known_good(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            args = guard.parser().parse_args(
                [
                    "--workspace",
                    str(workspace),
                    "--workflow-name",
                    "test",
                    "--minimum-free-bytes",
                    "0",
                    "--minimum-free-percent",
                    "0",
                    "--expected-peak-write-bytes",
                    "0",
                    "--",
                    sys.executable,
                    "-c",
                    "raise SystemExit(0)",
                ]
            )
            args.command = args.command[1:]
            self.assertEqual(0, guard.run_guarded(args))
            payload = json.loads((workspace / "data/moneytrail-engine/capacity_state.json").read_text())
            self.assertEqual("success", payload["last_success"]["status"])


if __name__ == "__main__":
    unittest.main()
