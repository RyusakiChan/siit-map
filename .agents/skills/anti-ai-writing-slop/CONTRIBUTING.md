# Contributing

Small, evidence-backed improvements are welcome.

1. Open an issue describing the writing failure mode and a minimal example.
2. Keep examples fictional and free of client, transcript, or identifying details.
3. Update the smallest relevant reference or script.
4. Run the Agent Skills validator and the full test suite before opening a pull request.

```bash
uvx --from "git+https://github.com/agentskills/agentskills.git#subdirectory=skills-ref" skills-ref validate "$PWD"
python3 -m unittest discover -s tests -v
python3 scripts/package_skill.py --output /tmp/anti-ai-writing-slop.zip
```

Avoid adding long phrase lists without explaining when a phrase is actually harmful. Context and voice evidence should win over blanket style folklore.
