# Contributing to PixelAgent

Thanks for your interest! PixelAgent is in `0.1.x` beta, and feedback shapes `0.2`.
Bug reports, ideas, and framework-support requests are all welcome — please
open an [issue](https://github.com/BryanOoh/pixelAgent/issues) first so we can
align before you invest in a PR.

## Project layout

PixelAgent is an npm-workspaces monorepo. Every published package versions in lockstep.

```
packages/
├── shared/      # @pixelagent/shared — types + DOM/session/preview utilities (no UI)
├── pixelagent/  # pixelagent — the React component (Shadow DOM, edit + annotate)
├── mcp/         # @pixelagent/mcp — local MCP server + dev-only Vite plugins
├── cli/         # @pixelagent/cli — `npx pixelagent setup`
└── demo/        # @pixelagent/demo — private Vite dev fixture (not published)
```

## Getting started

```bash
git clone https://github.com/BryanOoh/pixelAgent.git && cd pixelAgent
npm install
npm run build              # builds shared → pixelagent → mcp → cli
npm run dev                # demo app at http://localhost:5173
npm test                   # vitest across all workspaces
npm run typecheck          # tsc --noEmit across workspaces
npm run test:e2e:annotate  # Playwright annotate golden path
```

## Coding conventions

- **TypeScript strict** everywhere.
- **Named exports only** — no default exports except package entry points (for testability).
- Naming: components `PascalCase`, hooks `useX`, utilities `camelCase`,
  constants `SCREAMING_SNAKE`, MCP tools `snake_case`.
- `<PixelAgent />` is a client component and must render `null` when
  `NODE_ENV === 'production'`.
- All toolbar/panel UI lives inside the Shadow DOM — never leak styles to the host page.
- Panel interactions should stay within the ≤50ms budget; avoid unnecessary re-renders.
- Apply payloads use camelCase JSON keys; annotation output is pipe-separated markdown.
- Comment only non-obvious DOM traversal, source-mapping heuristics, and Tailwind-snapping logic.

## Tests

- Unit/component tests use Vitest (+ React Testing Library + jsdom).
- E2E uses Playwright.
- New behavior needs a test. Priorities: the annotate golden path, Apply payload
  assembly, the scope toggle, the production guard, and Shadow-DOM isolation.
- Please ensure `npm test` and `npm run typecheck` pass before opening a PR.

## Pull requests

1. Fork and branch from `main`.
2. Keep changes focused; one logical change per PR.
3. Add or update tests and the relevant entry in [`CHANGELOG.md`](./CHANGELOG.md)
   under `## [Unreleased]`.
4. Make sure `npm run build`, `npm test`, and `npm run typecheck` are green.
5. Open the PR with a clear description of the *why*, not just the *what*.

Maintainers handle version bumps and publishing — please don't bump package
versions in a PR.

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](./LICENSE).
