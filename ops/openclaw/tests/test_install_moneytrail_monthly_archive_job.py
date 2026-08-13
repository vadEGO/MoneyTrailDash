from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "install_moneytrail_monthly_archive_job.py"
SPEC = importlib.util.spec_from_file_location("install_moneytrail_monthly_archive_job", MODULE_PATH)
assert SPEC and SPEC.loader
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)


def config():
    return {
        "workspace": "/workspace",
        "declaration_key": "moneytrail.monthly-archive-review.v1",
        "name": "MoneyTrail Monthly Soft Archive Review",
        "description": "review",
        "cron": "20 3 * * 0",
        "timezone": "Australia/Sydney",
    }


class MonthlyArchiveJobInstallerTests(unittest.TestCase):
    def test_desired_argv_is_guarded_and_idempotent(self):
        result = installer.desired_argv(config())
        self.assertIn("moneytrail_capacity_guard.py", result[1])
        self.assertIn("moneytrail_monthly_archive_review.py", result[8])
        self.assertEqual("--require-first-sunday", result[-1])

    def test_verify_requires_exact_schedule_and_payload(self):
        expected = config()
        job = {
            "id": "job-1",
            "name": expected["name"],
            "enabled": True,
            "schedule": {"kind": "cron", "expr": expected["cron"], "tz": expected["timezone"]},
            "payload": {"argv": installer.desired_argv(expected), "cwd": expected["workspace"]},
        }
        self.assertEqual("installed", installer.verify(expected, job)["status"])
        job["schedule"]["expr"] = "0 0 * * *"
        self.assertEqual("needs_update", installer.verify(expected, job)["status"])


if __name__ == "__main__":
    unittest.main()
