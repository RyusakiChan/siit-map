from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "SKILL.md"


class SkillLayoutTests(unittest.TestCase):
    def test_name_matches_skill_directory(self) -> None:
        skill_text = SKILL.read_text(encoding="utf-8")
        name_match = re.search(r"^name:\s*([a-z0-9-]+)\s*$", skill_text, re.MULTILINE)

        self.assertIsNotNone(name_match)
        self.assertEqual(name_match.group(1), ROOT.name)

    def test_skill_resource_links_exist(self) -> None:
        skill_text = SKILL.read_text(encoding="utf-8")
        link_targets = re.findall(r"\]\(([^)]+)\)", skill_text)
        local_targets = [
            target
            for target in link_targets
            if not target.startswith(("http://", "https://", "#"))
        ]

        self.assertTrue(local_targets)
        for target in local_targets:
            with self.subTest(target=target):
                self.assertTrue((ROOT / target).is_file())

    def test_core_instructions_are_agent_neutral(self) -> None:
        skill_text = SKILL.read_text(encoding="utf-8").lower()
        host_specific_terms = (
            "claude code",
            "codex",
            "gemini cli",
            "github copilot",
            "~/.claude",
            "~/.codex",
            "~/.gemini",
            "~/.copilot",
        )

        for term in host_specific_terms:
            with self.subTest(term=term):
                self.assertNotIn(term, skill_text)


if __name__ == "__main__":
    unittest.main()
