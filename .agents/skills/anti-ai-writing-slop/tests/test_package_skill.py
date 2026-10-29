from __future__ import annotations

import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
PACKAGER = ROOT / "scripts" / "package_skill.py"
SKILL_ROOT = "anti-ai-writing-slop/"


class PackageSkillTests(unittest.TestCase):
    def test_archive_has_one_correctly_named_root(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "skill.zip"
            result = subprocess.run(
                [sys.executable, str(PACKAGER), "--output", str(output)],
                capture_output=True,
                check=False,
                text=True,
            )

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            with ZipFile(output) as archive:
                names = archive.namelist()

            self.assertTrue(names)
            self.assertTrue(all(name.startswith(SKILL_ROOT) for name in names))
            self.assertIn(f"{SKILL_ROOT}SKILL.md", names)
            self.assertIn(f"{SKILL_ROOT}references/review-protocol.md", names)
            self.assertIn(f"{SKILL_ROOT}scripts/lint_draft.py", names)
            self.assertNotIn(f"{SKILL_ROOT}README.md", names)
            self.assertFalse(any("/tests/" in name for name in names))
            self.assertFalse(any("/.git/" in name for name in names))
            self.assertEqual(len(names), 10)

    def test_existing_archive_requires_force(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            output = Path(temporary_directory) / "skill.zip"
            first = subprocess.run(
                [sys.executable, str(PACKAGER), "--output", str(output)],
                capture_output=True,
                check=False,
                text=True,
            )
            second = subprocess.run(
                [sys.executable, str(PACKAGER), "--output", str(output)],
                capture_output=True,
                check=False,
                text=True,
            )

            self.assertEqual(first.returncode, 0)
            self.assertEqual(second.returncode, 1)
            self.assertIn("Use --force to replace it.", second.stdout)

    def test_archive_cannot_be_written_into_runtime_files(self) -> None:
        output = ROOT / "references" / "unexpected.zip"
        result = subprocess.run(
            [sys.executable, str(PACKAGER), "--output", str(output)],
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertEqual(result.returncode, 1)
        self.assertIn("inside its dist directory", result.stdout)
        self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
