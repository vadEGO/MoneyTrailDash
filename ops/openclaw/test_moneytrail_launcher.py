import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


LAUNCHER = Path(__file__).with_name("moneytrail_launcher.py")


class MoneyTrailLauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "data").mkdir()
        (self.root / "cwd").mkdir()
        self.runner = self.root / "runner.py"
        self.runner.write_text("import sys; print('runner', sys.argv[1])\n", encoding="utf-8")
        self.manifest = self.root / "manifest.json"
        self.manifest.write_text(json.dumps({
            "processes": {
                "moneytrail_fixture": {
                    "cwd": str(self.root / "cwd"),
                    "argv": [sys.executable, str(self.runner)],
                },
            },
        }), encoding="utf-8")

    def tearDown(self):
        self.temp.cleanup()

    def run_launcher(self, *extra):
        return subprocess.run([
            sys.executable, str(LAUNCHER), "--process", "moneytrail_fixture",
            "--manifest", str(self.manifest), "--runner", str(self.runner),
            "--runtime-dir", str(self.root / "runtime"), *extra,
        ], text=True, capture_output=True, env={**os.environ, "MONEYTRAIL_WORKSPACE": str(self.root)})

    def test_check_validates_without_lock_or_execution(self):
        result = self.run_launcher("--check")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('"status": "validated"', result.stdout)
        self.assertFalse((self.root / "data" / "moneytrail-engine" / "shared-process.lock").exists())

    def test_dry_run_does_not_execute(self):
        result = self.run_launcher("--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('"status": "dry_run"', result.stdout)

    def test_unknown_process_fails_closed(self):
        self.manifest.write_text(json.dumps({"processes": {}}), encoding="utf-8")
        result = self.run_launcher("--check")
        self.assertEqual(result.returncode, 78)
        self.assertIn("unknown MoneyTrail process", result.stderr)

    def test_missing_dependency_fails_closed(self):
        self.manifest.write_text(json.dumps({"processes": {"moneytrail_fixture": {
            "cwd": str(self.root / "cwd"), "argv": [sys.executable, str(self.root / "missing.py")]
        }}}), encoding="utf-8")
        result = self.run_launcher("--check")
        self.assertEqual(result.returncode, 78)
        self.assertIn("dependency is missing", result.stderr)

    def test_dispatch_propagates_child_status(self):
        result = self.run_launcher()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("runner moneytrail_fixture", result.stdout)


if __name__ == "__main__":
    unittest.main()
