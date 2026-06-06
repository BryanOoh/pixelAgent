# Changelog

All notable changes to this project will be documented in this file.

## [0.1.25] - 2026-06-06

### Added

- **Color token picker** on the Edit panel's Color fields. A swatches icon next
  to **Text color** (Typography), **Fill / Background** (Fill), and **Border
  color** (Border) opens a searchable popover of the page's color design tokens
  (any CSS custom property whose value is a color), each rendered as a swatch +
  name + value. Selecting one applies it; the active color is auto-highlighted.
  Mirrors the Text styles picker and hides itself when no color tokens exist.

## [0.1.24] - 2026-05-29

### Added

- **Element-type-aware section auto-open** in the Edit panel. Selecting an
  element now expands only the sections that matter for its type (at most two)
  instead of opening everything: editable text → Content + Typography;
  headings, links, list items and other text tags → Typography; buttons and
  form controls → Layout + Typography; images / SVG / other media → Layout;
  containers → Layout plus Border or Fill when a visible stroke or background is
  present; `<hr>` → Border. Targeting stays collapsed — it is meta, not visual
  styling.

### Changed

- `EditSection` now defaults to collapsed; the Edit panel decides which sections
  open per selected element (see above).

### Fixed

- Section auto-open no longer reflects the *previously* selected element. The
  defaults are derived from the element selected on the current render (reading
  the live DOM directly) rather than from the panel's `textKind` / `values`
  state, which arrives a render late — so a bordered container now reliably
  opens Layout + Border regardless of what was selected before it.

## [0.1.23] - 2026-05-28

### Added

- **Text styles picker** in the Edit panel's Typography section. A "styles
  library" icon button opens a searchable popover of typography presets
  (Figma-style), each applying `font-size` / `line-height` / `font-weight` as a
  single batched edit. Presets are derived live from the page's own CSS custom
  properties — Tailwind v4 `--text-<key>` (+ `--text-<key>--line-height` /
  `--text-<key>--font-weight`) and the semantic `--font-size-<key>` /
  `--leading-<key>` conventions — so the list reflects the project's real type
  scale. When no type tokens are found, the control hides itself.
- **Drag-to-adjust (scrub)** on numeric Edit fields — drag a field's label
  horizontally to change its value, Figma-style.

### Changed

- Edit panel section headers refreshed: rounded SVG accordion chevron (down when
  collapsed, up when open) and support for an icon action between the section
  title and the chevron.
- Hardened the MCP CSS patchers (`css-modules` and `global-css`) with expanded
  test coverage.

## [0.1.22] - 2026-05-28

### Changed

- `pixelagent` now injects its toolbar stylesheet automatically on import — the
  CSS ships inlined in the JS bundle and is added to `document.head` at runtime
  (the UI portals into the light DOM, so a global `<style>` is what reaches it).
  Consumers no longer need `import 'pixelagent/style.css'`.

### Removed

- The `pixelagent/style.css` package export — the stylesheet is now bundled into
  the component, so no separate CSS file is published. **Breaking:** setups that
  still `import 'pixelagent/style.css'` must drop that line.

## [0.1.21] - 2026-05-28

### Fixed

- Toolbar settings (gear) icon no longer renders distorted/off-center —
  replaced the malformed path with a clean, symmetric gear.

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
