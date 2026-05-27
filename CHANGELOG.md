# Changelog

All notable changes to this project will be documented in this file.

## [0.1.3] - 2026-05-26

### Added

- `@pixelagent/mcp/source-plugin` — dev-only Vite plugin that injects
  `data-pa-src="relative/path.tsx:line"` on every JSX opening element.
  Enables source resolution for Apply payloads on React 19 (which removed
  fiber `_debugSource`), and is the new primary path on React 18 as well.

### Changed

- `readReactSource` now reads `data-pa-src` first and falls back to
  `_debugSource` → `_debugOwner.type.name`. React 18 setups without the
  plugin continue to work via the fiber path.
- Edit panel Apply button now enables on pending-changes alone; when the
  source file is unknown the button shows a tooltip explaining the
  clipboard-only fallback.
- Apply status text in the Edit footer is color-coded (success / error).

## [0.1.0] - 2026-05-25

### Added

- `pixelagent` React component (Shadow DOM toolbar, annotate mode, CSS edit panel)
- `@pixelagent/mcp` local MCP server (`apply_visual_diff`, `resolve_element`, `get_design_tokens`)
- `@pixelagent/cli` and `npx pixelagent setup` via the main package bin shim
- `@pixelagent/shared` types and DOM utilities
