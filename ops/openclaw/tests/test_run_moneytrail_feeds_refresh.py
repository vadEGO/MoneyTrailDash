from __future__ import annotations

import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).resolve().parents[1] / "run_moneytrail_feeds_refresh.py"
SPEC = importlib.util.spec_from_file_location("run_moneytrail_feeds_refresh", MODULE_PATH)
assert SPEC and SPEC.loader
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class FeedsRefreshTest(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        module.ROOT = root
        module.CONTEXT_PATH = root / "FollowDaMO/knowledge/retrieval_context/context.json"
        module.RAG_STATUS_PATH = root / "data/lancedb_sync_status.json"
        module.RAG_LATEST_PATH = root / "data/openclaw-rag/latest.json"
        module.CONTEXT_PATH.parent.mkdir(parents=True)
        module.RAG_STATUS_PATH.parent.mkdir(parents=True)
        module.CONTEXT_PATH.write_text("last-known-good", encoding="utf-8")
        module.RAG_STATUS_PATH.write_text("{\"status\":\"ok\"}", encoding="utf-8")

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_order_is_sources_then_rag_then_export(self) -> None:
        calls: list[list[str]] = []

        def runner(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
            calls.append(command)
            return subprocess.CompletedProcess(command, 0, "", "")

        result = module.refresh_feeds("moneytrail_feeds_refresh", runner=runner, verifier=lambda: {"table_version": 7, "asset_count": 12})

        self.assertEqual(result["status"], "completed")
        self.assertIn("--stages", calls[0])
        self.assertEqual(calls[0][calls[0].index("--stages") + 1], "sources")
        self.assertEqual(calls[1][-1], "scripts/run_openclaw_rag_pipeline.py")
        self.assertEqual(calls[2][calls[2].index("--stages") + 1], "export")
        self.assertIn("--require-export", calls[2])

    def test_rag_failure_restores_last_known_good_context_and_status(self) -> None:
        self.module_context_before = module.CONTEXT_PATH.read_bytes()
        self.module_status_before = module.RAG_STATUS_PATH.read_bytes()
        calls: list[list[str]] = []

        def runner(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
            calls.append(command)
            if command[-1] == "scripts/run_openclaw_rag_pipeline.py":
                module.CONTEXT_PATH.write_text("partial-new-context", encoding="utf-8")
                module.RAG_STATUS_PATH.write_text("{\"status\":\"failed\"}", encoding="utf-8")
                raise RuntimeError("table version mismatch")
            return subprocess.CompletedProcess(command, 0, "", "")

        result = module.refresh_feeds("moneytrail_feeds_refresh", runner=runner, verifier=lambda: {})

        self.assertEqual(result["status"], "failed")
        self.assertEqual(len(calls), 2, "export must not run after a failed RAG handoff")
        self.assertEqual(module.CONTEXT_PATH.read_bytes(), self.module_context_before)
        self.assertEqual(module.RAG_STATUS_PATH.read_bytes(), self.module_status_before)

    def test_rerun_after_failure_is_idempotent(self) -> None:
        attempts = 0

        def runner(command: list[str], **_: object) -> subprocess.CompletedProcess[str]:
            nonlocal attempts
            if command[-1] == "scripts/run_openclaw_rag_pipeline.py":
                attempts += 1
                if attempts == 1:
                    raise RuntimeError("temporary retrieval failure")
            return subprocess.CompletedProcess(command, 0, "", "")

        first = module.refresh_feeds("moneytrail_feeds_refresh", runner=runner, verifier=lambda: {"table_version": 8, "asset_count": 12})
        second = module.refresh_feeds("moneytrail_feeds_refresh", runner=runner, verifier=lambda: {"table_version": 8, "asset_count": 12})

        self.assertEqual(first["status"], "failed")
        self.assertEqual(second["status"], "completed")
        self.assertEqual(attempts, 2)


if __name__ == "__main__":
    unittest.main()
