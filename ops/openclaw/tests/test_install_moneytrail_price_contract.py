import importlib.util
from pathlib import Path
import tempfile
import unittest


MODULE_PATH = Path(__file__).parents[1] / "install_moneytrail_price_contract.py"
SPEC = importlib.util.spec_from_file_location("install_moneytrail_price_contract", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class PriceContractInstallerTests(unittest.TestCase):
    def test_transform_is_idempotent(self) -> None:
        source = f"before\n{MODULE.OLD_CONSOLIDATION}\nbetween\n{MODULE.OLD_QUARANTINE}\nafter\n"
        updated, changed = MODULE.transform(source)
        self.assertTrue(changed)
        for old, new in MODULE.TRANSFORMS:
            self.assertIn(new, updated)
            self.assertNotIn(old, updated)
        repeated, repeated_changed = MODULE.transform(updated)
        self.assertFalse(repeated_changed)
        self.assertEqual(repeated, updated)

    def test_transform_fails_closed_when_anchor_drifts(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "missing or ambiguous"):
            MODULE.transform("unrelated exporter")

    def test_install_writes_and_verifies_runtime_exporter(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "export_cockpit_to_supabase.py"
            path.write_text(
                MODULE.OLD_CONSOLIDATION + "\n" + MODULE.OLD_QUARANTINE,
                encoding="utf-8",
            )
            self.assertTrue(MODULE.install(path))
            MODULE.verify(path)
            self.assertFalse(MODULE.install(path))


if __name__ == "__main__":
    unittest.main()
