# PixelAgent

> I got tired of describing pixels to my AI agent.

**🎬 Live demo + video → [bryangarage.dev/pixelagent](https://bryangarage.dev/pixelagent)**

The live DOM layer for vibe coders. Point at running code — not a screenshot. Your AI agent writes the exact diff.

## Status

`0.1.20` beta on npm — `npm install` gets the current release (see below). See [CHANGELOG.md](./CHANGELOG.md).

- **Annotate** (click → note → copy) — primary path, works day one.
- **Edit + Apply** — secondary beta surface. Source resolution works on React 18 (via fiber) and React 19 (via the new dev-only Vite plugin).

## Install

```bash
npm install pixelagent @pixelagent/mcp
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

### React 19 — opt into source resolution

React 19 removed fiber `_debugSource`. To recover exact-file Apply payloads, add the dev-only Vite plugin:

```ts
// vite.config.ts
import { pixelagentSourcePlugin } from '@pixelagent/mcp/source-plugin';
import { pixelagentVitePlugin } from '@pixelagent/mcp/vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    pixelagentSourcePlugin({ projectRoot: __dirname }), // must run before react()
    react(),
    pixelagentVitePlugin({ projectRoot: __dirname }),
  ],
});
```

Production builds are never transformed (`apply: 'serve'`).

## Two modes

### Annotate in 30 seconds

1. Click **Annotate** on the floating toolbar.
2. Click any page element → type a **Note** → **Add**.
3. Session opens on the right; click toolbar **Copy** or session **Copy all** (same markdown).
4. Paste into your agent chat.

No verbosity or viewport toggles — context is included automatically.

### Edit + Apply

1. Click **Edit** on the toolbar → click an element.
2. Tweak font / spacing / color in the side panel — changes preview live on the DOM.
3. Click **Apply** → payload is sent to MCP (auto-patches the source) or copied to clipboard (paste into your agent).

## Quick start (from source)

```bash
git clone https://github.com/BryanOoh/pixelAgent.git && cd pixelAgent
npm install
npm run build
npm run dev              # demo at http://localhost:5173
npm test                 # 80 tests
npx pixelagent setup     # configure MCP for Claude Code / Cursor
```

## Project structure

```
pixelAgent/
└── packages/
    ├── shared/            # @pixelagent/shared — types & DOM utilities
    ├── pixelagent/        # React component
    ├── mcp/               # @pixelagent/mcp server (+ vite-plugin, source-plugin)
    ├── cli/               # npx pixelagent setup
    └── demo/              # Vite dev fixture
```

## Packages

| Package | Description |
|---------|-------------|
| [`pixelagent`](https://www.npmjs.com/package/pixelagent) | React component — Shadow DOM toolbar, annotate + edit panel |
| [`@pixelagent/mcp`](https://www.npmjs.com/package/@pixelagent/mcp) | Local MCP server + dev-only Vite plugins (apply, source) |
| [`@pixelagent/cli`](https://www.npmjs.com/package/@pixelagent/cli) | `npx pixelagent setup` — configure MCP for Claude Code / Cursor |
| [`@pixelagent/shared`](https://www.npmjs.com/package/@pixelagent/shared) | Types and DOM utilities |

## Feedback

This is `0.1.x` beta — feedback shapes `0.2`. Please open an [issue](https://github.com/BryanOoh/pixelAgent/issues) for bugs, ideas, or framework support requests.

## License

MIT — see [LICENSE](./LICENSE).
