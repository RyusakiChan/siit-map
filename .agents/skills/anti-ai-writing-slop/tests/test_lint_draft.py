from __future__ import annotations

import subprocess
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LINTER = ROOT / "scripts" / "lint_draft.py"


def run_linter(text: str, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, str(LINTER), *args],
        input=text,
        capture_output=True,
        check=False,
        text=True,
    )


class LintDraftTests(unittest.TestCase):
    def test_clean_draft_passes(self) -> None:
        result = run_linter(
            "The opening takes 4 sentences to reach the decision. "
            "Cut the setup and keep the example."
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("No configured patterns found.", result.stdout)

    def test_common_patterns_fail(self) -> None:
        result = run_linter(
            "Furthermore, this is not editing. This is a game-changer. "
            "Let that sink in."
        )
        self.assertEqual(result.returncode, 1)
        self.assertIn("empty contrast frame", result.stdout)
        self.assertIn("empty transition", result.stdout)
        self.assertIn("engagement bait", result.stdout)
        self.assertIn("stock AI wording", result.stdout)

    def test_em_dash_is_configurable(self) -> None:
        allowed = run_linter("Keep the useful pause — if it belongs to the writer.")
        banned = run_linter(
            "Keep the useful pause — if it belongs to the writer.", "--ban-em-dash"
        )
        self.assertEqual(allowed.returncode, 0)
        self.assertEqual(banned.returncode, 1)
        self.assertIn("banned em dash", banned.stdout)


if __name__ == "__main__":
    unittest.main()
