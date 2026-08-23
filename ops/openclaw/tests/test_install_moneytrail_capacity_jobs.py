from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "install_moneytrail_capacity_jobs.py"
SPEC = importlib.util.spec_from_file_location("install_moneytrail_capacity_jobs", MODULE_PATH)
assert SPEC and SPEC.loader
installer = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(installer)


class CapacityJobInstallerTest(unittest.TestCase):
    def test_feeds_job_uses_explicit_rag_dependency_entry_point(self) -> None:
        config = installer.load_config(Path(__file__).resolve().parents[1] / "moneytrail_capacity_jobs.json")
        feeds = next(job for job in config["jobs"] if job["workflow_name"] == "moneytrail_feeds_refresh")
        self.assertEqual(feeds["engine_argv"][1], "MoneyTrailDash/ops/openclaw/run_moneytrail_feeds_refresh.py")
        self.assertNotIn("--stages", feeds["engine_argv"])

    def test_guarded_argv_keeps_engine_workflow_and_arguments(self) -> None:
        job = {
            "workflow_name": "moneytrail_test",
            "engine_argv": ["python3", "scripts/run_moneytrail_engine.py", "--workflow-name", "moneytrail_test"],
        }
        result = installer.guarded_argv(Path("/workspace"), job)
        self.assertEqual("python3", result[0])
        self.assertIn("moneytrail_capacity_guard.py", result[1])
        self.assertEqual("moneytrail_test", result[5])
        self.assertEqual("--", result[6])
        self.assertEqual("python3", result[7])
        self.assertIn("moneytrail_stale_idea_lifecycle.py", result[8])
        self.assertEqual("/workspace", result[10])
        self.assertEqual("moneytrail_test", result[12])
        self.assertEqual("--", result[13])
        self.assertEqual(job["engine_argv"], result[14:])

    def test_verify_rejects_name_mismatch(self) -> None:
        config = {
            "workspace": "/workspace",
            "jobs": [{"id": "1", "name": "Expected", "workflow_name": "test", "engine_argv": ["true"]}],
        }
        result = installer.verify(config, {"1": {"id": "1", "name": "Wrong", "payload": {"argv": []}}})
        self.assertEqual("name_mismatch", result[0]["status"])


if __name__ == "__main__":
    unittest.main()
