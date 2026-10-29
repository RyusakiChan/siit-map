# Anti-AI Writing Slop

A portable Agent Skill for reviewing public-facing copy without sanding off the writer's voice.

It checks a draft against its audience, source material, and voice profile. It catches unsupported claims, generic AI phrasing, fake punchiness, empty transitions, and polished corporate filler. Then it makes the smallest useful edit.

The core package follows the [open Agent Skills specification](https://agentskills.io/specification). Host-specific metadata lives outside `SKILL.md`, so other agents can ignore it safely.

## Works with

| Agent | Personal install | Project install |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/anti-ai-writing-slop` | `.claude/skills/anti-ai-writing-slop` |
| Codex | `~/.agents/skills/anti-ai-writing-slop` | `.agents/skills/anti-ai-writing-slop` |
| Gemini CLI | `~/.gemini/skills/anti-ai-writing-slop` | `.gemini/skills/anti-ai-writing-slop` |
| GitHub Copilot | `~/.copilot/skills/anti-ai-writing-slop` | `.github/skills/anti-ai-writing-slop` |
| Shared Agent Skills clients | `~/.agents/skills/anti-ai-writing-slop` | `.agents/skills/anti-ai-writing-slop` |

Claude Code, Codex, Gemini CLI, and GitHub Copilot document native Agent Skills support. Claude accepts uploaded skill packages. ChatGPT Personal Skills are generally available for Business, Enterprise, Healthcare, and Edu workspaces when the required permissions are enabled. Other clients can use the same folder when they implement the open specification.

## Install

### Claude Code

```bash
git clone https://github.com/thomasmeijer92/anti-ai-writing-slop.git ~/.claude/skills/anti-ai-writing-slop
```

Claude Code can invoke it automatically or through:

```text
/anti-ai-writing-slop
```

### Codex

```bash
git clone https://github.com/thomasmeijer92/anti-ai-writing-slop.git ~/.agents/skills/anti-ai-writing-slop
```

Invoke it with:

```text
Use $anti-ai-writing-slop to review this draft and keep my voice intact.
```

### Gemini CLI

```bash
gemini skills install https://github.com/thomasmeijer92/anti-ai-writing-slop
```

### GitHub Copilot CLI

```bash
copilot skill add https://github.com/thomasmeijer92/anti-ai-writing-slop
```

### Claude

Build the uploadable package:

```bash
python3 scripts/package_skill.py
```

In Claude, open **Customize > Skills**, choose **Create skill**, and upload `dist/anti-ai-writing-slop.zip`.

### ChatGPT

Build the same package:

```bash
python3 scripts/package_skill.py
```

In ChatGPT, open **Plugins > Skills > Create > Upload from your computer**. Personal Skills are generally available for Business, Enterprise, Healthcare, and Edu workspaces. Admin settings can disable skill creation or uploads.

The archive contains a single `anti-ai-writing-slop` folder with the runtime files.

### Other agents

Place this repository in the skill directory your client watches. A compatible client should:

1. Discover `SKILL.md`.
2. Use its `name` and `description` to decide when the skill applies.
3. Load the Markdown body when activated.
4. Resolve referenced files from the skill root.

Agents without Python can still use the full review workflow. The linter is optional.

## What is included

- A repeatable review protocol with 3 ratings: **Needs work**, **Good**, and **Ready**
- A starter voice profile that can be replaced by project or personal rules
- Banned and suspect writing patterns
- Fictional examples in English and Dutch
- A dependency-free linter for common English patterns
- A packager for Claude, ChatGPT, and other upload-based clients
- Optional OpenAI UI metadata and an icon in `agents/openai.yaml`

The linter is a first pass. It cannot judge factual support, context, rhythm, or whether a line sounds like the writer.

## Customize the voice

Edit [`references/voice-profile.md`](references/voice-profile.md), or provide stronger workspace and project rules. Personal rules take precedence over the starter profile.

Keep private samples outside a public fork. The skill treats samples as evidence and prevents private transcript or client details from leaking into reviewed copy.

## Privacy

This public version contains fictional examples only. It does not include private transcripts, client details, personal platform preferences, or copied voice samples.

## References

- [Agent Skills specification](https://agentskills.io/specification)
- [Claude Code skills](https://code.claude.com/docs/en/slash-commands)
- [Claude custom skill uploads](https://support.claude.com/en/articles/12512180-use-skills-in-claude)
- [Codex and ChatGPT skills](https://learn.chatgpt.com/docs/build-skills)
- [ChatGPT Skills](https://help.openai.com/en/articles/20001066)
- [Gemini CLI skills](https://geminicli.com/docs/cli/using-agent-skills/)
- [GitHub Copilot skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills)

## License

[MIT](LICENSE)
