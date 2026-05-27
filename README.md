# PixelAgent

The live DOM layer for vibe coders.

Point at running code — not a screenshot. Your AI agent writes the exact diff.

## Status

Pre-release `0.1.0` — packages build and test locally. See `CHANGELOG.md`.

**Annotate** (click → note → copy) is the primary early-access path; Edit + MCP Apply are secondary beta surfaces.

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

# Annotate golden path (unit + Playwright on demo)
npm run test:e2e:annotate

# Configure MCP (optional)
npx pixelagent setup
```

### Annotate in 30 seconds

1. Open the demo → click **Annotate** on the floating toolbar.
2. Click any page element → type a **Note** → **Add**.
3. Session opens on the right; click toolbar **Copy** or session **Copy all** (same markdown).
4. Paste into your agent chat.

No verbosity or viewport toggles — context is included automatically.

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

## License

MIT — see [LICENSE](./LICENSE).
