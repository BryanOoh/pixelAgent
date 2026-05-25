#!/usr/bin/env node
/**
 * Shim so `npx pixelagent setup` works from the main `pixelagent` package.
 * Implementation lives in @pixelagent/cli.
 */
import '@pixelagent/cli/dist/index.js';
