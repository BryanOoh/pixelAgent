# PixelAgent

The live DOM layer for vibe coders.

Point at running code — not a screenshot. Your AI agent writes the exact diff.

## Status

Pre-release `0.1.0` — packages build and test locally. See `CHANGELOG.md`.

### Publish checklist

```bash
npm test
npm run publish:check-scope   # requires npm login + @pixelagent org
npm run pack:check
npm run publish:beta          # or publish:stable
```

Override monorepo URL before publish: `export PIXELAGENT_REPO_URL=git+https://github.com/<you>/<repo>.git`

## Quick start

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run demo app (http://localhost:5173)
npm run dev

# Run tests
npm test

# Configure MCP (optional)
npx pixelagent setup
```

In your app:

```tsx
import { PixelAgent } from 'pixelagent';
import 'pixelagent/style.css';

export default function Layout({ children }) {
  return (
    <>
      {children}
      {process.env.NODE_ENV !== 'production' && <PixelAgent />}
    </>
  );
}
```

## Project structure

```
pixelAgent/
├── CLAUDE.md              # Team instructions
├── CLAUDE.local.md        # Personal overrides (gitignored)
├── design.md              # PRD v0.4 design document
├── .claude/
│   ├── settings.json
│   ├── commands/          # /project:review, fix-issue, deploy
│   ├── rules/             # code-style, testing, api-conventions
│   ├── skills/            # security-review, deploy
│   └── agents/            # code-reviewer, security-auditor
└── packages/
    ├── shared/            # @pixelagent/shared — types & DOM utilities
    ├── pixelagent/        # React component
    ├── mcp/               # @pixelagent/mcp server
    ├── cli/               # npx pixelagent setup
    └── demo/              # Vite dev fixture
```

## Three packages

| Package | Description |
|---------|-------------|
| `pixelagent` | React component — Shadow DOM toolbar, annotate + edit panel |
| `@pixelagent/mcp` | Local MCP server — apply diffs, resolve elements, read design tokens |
| CLI | `npx pixelagent setup` — configure MCP for Claude Code / Cursor |

## Docs

- [Design document](./design.md) — architecture, user stories, roadmap
- [Team instructions](./CLAUDE.md) — development workflow

## License

MIT — see [LICENSE](./LICENSE).
