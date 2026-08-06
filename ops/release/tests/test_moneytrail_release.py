import argparse
import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import moneytrail_release as release


class ReleaseCoordinatorTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)
        self.lease = self.root / "lease.json"

    def tearDown(self):
        self.tempdir.cleanup()

    def capture(self, function, args):
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream):
            code = function(args)
        return code, json.loads(stream.getvalue())

    def test_lease_has_single_owner(self):
        first = argparse.Namespace(
            lease_path=str(self.lease),
            owner="thread-a",
            automation_id="evolution",
            candidate_id="candidate-a",
            branch=None,
            release_id="release-a",
            ttl_minutes=30,
        )
        code, result = self.capture(release.command_claim, first)
        self.assertEqual(code, 0)
        self.assertEqual(result["status"], "claimed")

        second = argparse.Namespace(**{**vars(first), "owner": "thread-b", "release_id": "release-b"})
        code, result = self.capture(release.command_claim, second)
        self.assertEqual(code, 0)
        self.assertEqual(result["status"], "busy")
        self.assertEqual(result["active_release"]["owner"], "thread-a")

    def test_release_requires_matching_owner(self):
        claim = argparse.Namespace(
            lease_path=str(self.lease),
            owner="thread-a",
            automation_id="evolution",
            candidate_id="candidate-a",
            branch=None,
            release_id="release-a",
            ttl_minutes=30,
        )
        self.capture(release.command_claim, claim)
        with self.assertRaises(PermissionError):
            release.command_release(
                argparse.Namespace(
                    lease_path=str(self.lease),
                    owner="thread-b",
                    release_id="release-a",
                    outcome="failed",
                    manifest_path=None,
                )
            )

    def test_candidate_gate_allows_noop(self):
        args = argparse.Namespace(
            decision_value=40,
            coverage_gap=40,
            user_impact=40,
            evidence_quality=40,
            freshness_gain=20,
            reversibility=80,
            operational_risk=80,
            effort=80,
            threshold=70,
            health_status="green",
            overlaps_active_work=False,
            source_legal_status="clear",
        )
        code, result = self.capture(release.command_gate, args)
        self.assertEqual(code, 0)
        self.assertEqual(result["decision"], "noop")

    def test_candidate_gate_blocks_degraded_health(self):
        args = argparse.Namespace(
            decision_value=100,
            coverage_gap=100,
            user_impact=100,
            evidence_quality=100,
            freshness_gain=100,
            reversibility=100,
            operational_risk=0,
            effort=0,
            threshold=70,
            health_status="degraded",
            overlaps_active_work=False,
            source_legal_status="clear",
        )
        _, result = self.capture(release.command_gate, args)
        self.assertEqual(result["decision"], "noop")
        self.assertIn("system health is degraded", result["blockers"])

    def test_preview_manifest_rejects_production_supabase(self):
        manifest_path = self.root / "manifest.json"
        manifest = release.manifest_skeleton("release-a", "Title", "candidate-a")
        manifest["freshness"]["baseline"] = {"analysis": "fresh"}
        manifest["git"].update(
            {
                "branch": "agent/test",
                "pull_request": 1,
                "tested_commit": "abc",
            }
        )
        manifest["openclaw"]["manual_run_id"] = "run-1"
        manifest["supabase"]["preview_project_ref"] = release.PRODUCTION_SUPABASE_REF
        manifest["vercel"].update(
            {
                "preview_deployment_id": "dpl_preview",
                "preview_commit": "abc",
            }
        )
        release.atomic_write_json(manifest_path, manifest)
        code, result = self.capture(
            release.command_validate_manifest,
            argparse.Namespace(path=str(manifest_path), phase="preview"),
        )
        self.assertEqual(code, 4)
        self.assertIn("Supabase preview project must differ from production", result["errors"])

    def test_production_manifest_requires_exact_commit_and_no_regression(self):
        manifest_path = self.root / "manifest.json"
        manifest = release.manifest_skeleton("release-a", "Title", "candidate-a")
        manifest["freshness"] = {
            "baseline": {"analysis": "fresh"},
            "after": {"analysis": "fresh"},
            "regressions": ["macro stale"],
        }
        manifest["git"].update(
            {
                "branch": "agent/test",
                "pull_request": 1,
                "tested_commit": "abc",
                "merged_commit": "def",
            }
        )
        manifest["openclaw"]["manual_run_id"] = "run-1"
        manifest["supabase"].update(
            {
                "preview_project_ref": "previewref",
                "security_verified": True,
                "data_verified": True,
            }
        )
        manifest["vercel"].update(
            {
                "preview_deployment_id": "dpl_preview",
                "preview_commit": "abc",
                "production_deployment_id": "dpl_prod",
                "production_commit": "wrong",
                "status": "READY",
            }
        )
        manifest["rollback"] = {
            "git_commit": "old",
            "vercel_deployment_id": "dpl_old",
            "data_contract_version": "v0",
        }
        release.atomic_write_json(manifest_path, manifest)
        code, result = self.capture(
            release.command_validate_manifest,
            argparse.Namespace(path=str(manifest_path), phase="production"),
        )
        self.assertEqual(code, 4)
        self.assertIn("Vercel production commit does not match git.merged_commit", result["errors"])
        self.assertIn("freshness regressions must be empty", result["errors"])

    def test_runtime_install_is_hash_verified(self):
        destination = self.root / "runtime"
        code, result = self.capture(
            release.command_install_runtime,
            argparse.Namespace(destination=str(destination), source_commit="abc123"),
        )
        self.assertEqual(code, 0)
        self.assertEqual(result["status"], "installed")

        code, result = self.capture(
            release.command_verify_runtime,
            argparse.Namespace(destination=str(destination), source_commit="abc123"),
        )
        self.assertEqual(code, 0)
        self.assertEqual(result["status"], "valid")

        (destination / "contract.md").write_text("drift", encoding="utf-8")
        code, result = self.capture(
            release.command_verify_runtime,
            argparse.Namespace(destination=str(destination), source_commit="abc123"),
        )
        self.assertEqual(code, 6)
        self.assertIn("contract.md: hash mismatch", result["failures"])


if __name__ == "__main__":
    unittest.main()
