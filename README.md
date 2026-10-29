# SIIT Map

A phone-first 3D web map of the 5-floor SIIT Main Building at Thammasat University Rangsit campus, hosted on GitHub Pages. This is an unofficial student project. Scope, data decisions and the weekly schedule are in [PLAN.md](PLAN.md); working rules are in [AGENTS.md](AGENTS.md).

## Requirements

Node.js 22 or newer.

## Commands

```
npm install      # install dependencies
npm run dev      # dev server at http://localhost:5173
npm run build    # type-check and build to dist/ (base path /siit-map/)
npm run preview  # serve the production build
npm test         # unit tests (vitest), including the building.json data check
npm run lint     # ESLint
```

After cloning on Windows, run `~/.claude/scripts/Sync-CodexWorkspace.ps1 -Project <folder>` to relink `.claude/skills`.

## Credits

The building outline comes from OpenStreetMap (way 195958489). © OpenStreetMap contributors, licensed under the [ODbL](https://opendatacommons.org/licenses/odbl/). Current room data is fake sample data.
