#!/usr/bin/env node
/**
 * `npx pixelagent setup` entry point.
 *
 * The setup logic lives in @pixelagent/cli, which is intentionally NOT a
 * dependency of this package. The React component must stay lean — pulling
 * the CLI in as a dependency would drag the MCP server + Babel toolchain
 * into every consumer's node_modules, even for annotate-only users.
 * Instead we fetch the CLI on demand via npx, so MCP tooling is only
 * installed when someone actually runs setup.
 */
import { spawn } from 'node:child_process';

const child = spawn('npx', ['-y', '@pixelagent/cli', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('error', (err) => {
  console.error('Failed to launch @pixelagent/cli via npx:', err.message);
  process.exit(1);
});

child.on('exit', (code) => process.exit(code ?? 0));
