# Security Policy

## Supported versions

PixelAgent is in `0.1.x` beta. Security fixes are applied to the latest published
release only. Please upgrade to the current version before reporting an issue.

| Version | Supported |
|---------|-----------|
| latest `0.1.x` | ✅ |
| older `0.1.x`  | ❌ |

## Privacy & threat model

PixelAgent is designed to keep your code on your machine:

- The `pixelagent` component runs entirely client-side and renders `null` in
  production builds.
- No DOM content or source code is sent to any PixelAgent server — there is no
  PixelAgent backend.
- `@pixelagent/mcp` runs **locally**. It reads and patches files within the
  project root you configure (`PIXELAGENT_PROJECT_ROOT`) and never phones home.
- The dev-only Vite source plugin (`data-pa-src` injection) is gated to
  `apply: 'serve'` and never runs in production builds.

The most security-relevant surface is `@pixelagent/mcp`, which can **write to
your source files** via `apply_visual_diff`. Treat it like any tool with local
filesystem write access, and review the diffs it produces.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via GitHub's
[**Report a vulnerability**](https://github.com/BryanOoh/pixelAgent/security/advisories/new)
form (repository **Security → Advisories**). Include:

- affected package(s) and version,
- a description and impact assessment,
- reproduction steps or a proof of concept.

We aim to acknowledge reports within a few business days. Once a fix is released,
we're happy to credit you in the advisory unless you prefer to remain anonymous.
