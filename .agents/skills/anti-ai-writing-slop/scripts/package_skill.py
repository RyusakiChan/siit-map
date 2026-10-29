#!/usr/bin/env python3
"""Build an uploadable Agent Skill ZIP with the correct root folder."""

from __future__ import annotations

import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


SKILL_NAME = "anti-ai-writing-slop"
ROOT = Path(__file__).resolve().parents[1]
PACKAGE_FILES = (
    Path("SKILL.md"),
    Path("LICENSE"),
    Path("agents/openai.yaml"),
    Path("assets/icon.svg"),
    Path("references/ai-patterns.md"),
    Path("references/banned-patterns.md"),
    Path("references/review-protocol.md"),
    Path("references/spoken-flow.md"),
    Path("references/voice-profile.md"),
    Path("scripts/lint_draft.py"),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build an uploadable ZIP for Claude, ChatGPT, and Agent Skills clients."
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "dist" / f"{SKILL_NAME}.zip",
        help="Archive path. Defaults to dist/anti-ai-writing-slop.zip.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace an existing archive.",
    )
    return parser.parse_args()


def package_files() -> list[Path]:
    files: list[Path] = []
    for relative_path in PACKAGE_FILES:
        source = ROOT / relative_path
        if source.is_symlink():
            raise ValueError(f"Package paths cannot contain symlinks: {relative_path}")
        if not source.is_file():
            raise FileNotFoundError(f"Required package path is missing: {relative_path}")
        files.append(source)
    return sorted(files)


def build_archive(output: Path, force: bool = False) -> Path:
    output = output.expanduser().resolve()
    if output.is_relative_to(ROOT) and not output.is_relative_to(ROOT / "dist"):
        raise ValueError("Write archives outside the repository or inside its dist directory.")
    if output.exists() and not force:
        raise FileExistsError(f"Archive already exists: {output}. Use --force to replace it.")

    files = package_files()
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        for source in files:
            relative_path = source.relative_to(ROOT)
            archive.write(source, Path(SKILL_NAME) / relative_path)
    return output


def main() -> int:
    args = parse_args()
    try:
        output = build_archive(args.output, args.force)
    except (FileExistsError, FileNotFoundError, ValueError) as error:
        print(error)
        return 1
    print(f"Built {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
