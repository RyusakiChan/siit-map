---
name: anti-ai-writing-slop
description: Review and rewrite client-facing, social, marketing, or public copy so it stays specific, evidence-aware, and recognizably in the author's voice. Use when asked to critique, polish, de-slop, humanize, or make a draft sendable or publishable without flattening its personality.
---

# Anti-AI Writing Slop

Review the actual draft against its audience, evidence, and voice contract. Change only what makes it clearer, truer, or more recognizably the author's.

## Required reading

Always read:

1. [references/review-protocol.md](references/review-protocol.md)
2. [references/banned-patterns.md](references/banned-patterns.md)
3. [references/voice-profile.md](references/voice-profile.md)
4. Relevant workspace, brand, or project writing rules

Read [references/spoken-flow.md](references/spoken-flow.md) when cadence is the problem. Read [references/ai-patterns.md](references/ai-patterns.md) when the draft feels generic or synthetic. Do not load both example files by default.

## Workflow

1. Identify the audience, intended action, supported facts, and available voice evidence.
2. Use explicit user or project rules before the starter voice profile. If no custom rules exist, say that the starter profile is being used.
3. Apply the blocking and material checks in the review protocol.
4. Cite the exact phrase and rule for each blocking or material finding.
5. Preserve supported facts, intent, useful roughness, and distinctive wording.
6. Revise in place unless the user asked for critique only.
7. Recheck the revision. Stop when it is ready or after 3 rounds.

If Python 3 and file access are available, use the bundled linter for a deterministic first pass on common English patterns:

```bash
python3 scripts/lint_draft.py path/to/draft.md
```

Add `--ban-em-dash` only when the author's voice profile bans that punctuation.

If the runtime cannot execute scripts, apply the same checks from `references/banned-patterns.md` manually. Do not treat script access as a requirement for completing the review.

## Boundaries

- Do not replace factual research with a style pass.
- Do not invent proof, metrics, quotes, certainty, or personal experience.
- Do not expose private voice samples, transcripts, client details, or hidden context in the review.
- Do not force casual language, quirks, or slang that the evidence does not support.
- Do not smooth a clear draft into generic corporate prose.

## Output

Return:

- rating
- blocking findings
- concise material findings
- revised copy, unless critique only was requested
- final verdict

When the user only needs the improved draft, keep the review transcript internal and return the copy plus a one-line verdict.

## Success criteria

The copy answers the real request, makes only supportable claims, matches the available voice evidence, contains no blocking patterns, and is ready for its intended audience.
