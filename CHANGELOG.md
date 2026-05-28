# Changelog

All notable changes to this project will be documented in this file.

## [0.1.20] - 2026-05-28

### Changed

- `pixelagent` (the React component) no longer bundles `@pixelagent/cli`. Its
  only runtime dependency is now `@pixelagent/shared`, so annotate-only installs
  no longer pull the MCP server or Babel toolchain into `node_modules`.
  `npx pixelagent setup` still works — the bin shim fetches the CLI on demand
  via `npx`.
- `npx pixelagent setup` now writes an MCP server config that launches
  `@pixelagent/mcp` via `npx` instead of a hardcoded `node <path>`, removing a
  fragile path into `node_modules`. `@pixelagent/cli` no longer depends on
  `@pixelagent/mcp`.

## [0.1.19] - 2026-05-27

### Changed

- Edit panel now reflects existing `:state` (hover/focus/etc.) CSS rules when opened.

## [0.1.18] - 2026-05-27

### Fixed

- Edit panel no longer renders empty on element selection (0.1.17 regression).

## [0.1.17] - 2026-05-27

### Changed

- Reset panel values when switching the edited state.

## [0.1.16] - 2026-05-27

### Added

- Runtime state styles so hover/focus edits survive in production demos.

## [0.1.15] - 2026-05-27

### Fixed

- Unique sidecar classes plus `!important` so hover styles actually win.

## [0.1.14] - 2026-05-27

### Changed

- Apply now uses explicit HMR updates instead of a full page reload.

## [0.1.13] - 2026-05-27

### Fixed

- Per-state pending edits so hover edits no longer bleed into the normal state.

## [0.1.12] - 2026-05-27

### Fixed

- Force a full reload after an Apply touches a sidecar file.

## [0.1.11] - 2026-05-27

### Changed

- Revert local preview overrides after a successful Apply.

## [0.1.10] - 2026-05-26

### Fixed

- Re-Apply on inline + state no longer mis-routes to global CSS.

## [0.1.9] - 2026-05-26

### Added

- Inline + state editing via sidecar CSS.

## [0.1.8] - 2026-05-26

### Fixed

- Guard the inline + non-normal state path.

## [0.1.7] - 2026-05-26

### Changed

- Persist pending edits across element switches.

## [0.1.6] - 2026-05-26

### Added

- Auto-inject `style={}` and binary (success/error) Apply feedback.

## [0.1.5] - 2026-05-26

### Added

- Wire Apply → MCP Vite plugin endpoint.

## [0.1.4] - 2026-05-26

### Added

- Display dropdown and Spacing pair / 4-side toggle in the Edit panel.

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

## [0.1.2] - 2026-05-25

### Fixed

- Skip `__`-prefixed framework wrappers during source resolution.

## [0.1.1] - 2026-05-25

### Fixed

- Component-name fallback for minified builds.

## [0.1.0] - 2026-05-25

### Added

- `pixelagent` React component (Shadow DOM toolbar, annotate mode, CSS edit panel)
- `@pixelagent/mcp` local MCP server (`apply_visual_diff`, `resolve_element`, `get_design_tokens`)
- `@pixelagent/cli` and `npx pixelagent setup` via the main package bin shim
- `@pixelagent/shared` types and DOM utilities
