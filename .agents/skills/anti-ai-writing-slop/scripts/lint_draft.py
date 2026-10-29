#!/usr/bin/env python3
"""Flag common English AI-writing patterns in a text draft."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path


PATTERNS = {
    "empty contrast frame": [
        r"\bthis (?:is|was)(?:n['’]?t| not)\b[^.\n]{1,120}\.\s*this (?:is|was)\b",
        r"\bit['’]?s not about\b.+\bit['’]?s about\b",
        r"\bless\b[^.\n]{1,80}[,.]\s*more\b",
    ],
    "engagement bait": [
        r"\blet that sink in\b",
        r"\bread that again\b",
        r"\bthis changes everything\b",
        r"\byou['’]?re not ready for this\b",
    ],
    "generic insider claim": [
        r"\bhere['’]?s the part nobody['’]?s talking about\b",
        r"\bwhat nobody tells you\b",
        r"\bmost people don['’]?t realize\b",
    ],
    "stock AI wording": [
        r"\bdelve\b",
        r"\bdive into\b",
        r"\bleverage\b",
        r"\butilize\b",
        r"\bgame[- ]changer\b",
        r"\bcutting[- ]edge\b",
        r"\bin order to\b",
        r"\bsupercharge\b",
        r"\bfuture[- ]proof\b",
        r"\bin the age of ai\b",
    ],
    "empty transition": [
        r"\bfurthermore\b",
        r"\badditionally\b",
        r"\bmoreover\b",
        r"\bmoving forward\b",
        r"\bat the end of the day\b",
        r"\bit goes without saying\b",
    ],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Flag common English AI-writing patterns in a draft."
    )
    parser.add_argument("draft", nargs="?", help="Draft file. Reads stdin when omitted.")
    parser.add_argument(
        "--ban-em-dash",
        action="store_true",
        help="Flag em dashes when the active voice profile bans them.",
    )
    return parser.parse_args()


def read_text(path: str | None) -> str:
    if path:
        return Path(path).read_text(encoding="utf-8")
    return sys.stdin.read()


def line_number(text: str, position: int) -> int:
    return text.count("\n", 0, position) + 1


def main() -> int:
    args = parse_args()
    text = read_text(args.draft)
    findings: list[tuple[int, str, str]] = []

    for label, patterns in PATTERNS.items():
        for pattern in patterns:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                findings.append(
                    (line_number(text, match.start()), label, match.group(0).strip())
                )

    if args.ban_em_dash:
        for match in re.finditer("—", text):
            findings.append((line_number(text, match.start()), "banned em dash", "—"))

    for line, label, phrase in sorted(findings):
        print(f"{line}: {label}: {phrase}")

    if findings:
        print(f"\nFound {len(findings)} suspect pattern(s).", file=sys.stderr)
        return 1

    print("No configured patterns found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
