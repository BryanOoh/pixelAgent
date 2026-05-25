#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PUBLISH_WORKSPACES = [
  '@pixelagent/shared',
  '@pixelagent/mcp',
  '@pixelagent/cli',
  'pixelagent',
];

function run(cmd) {
  return execSync(cmd, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

console.log('→ npm run build');
run('npm run build');

let failed = false;

for (const ws of PUBLISH_WORKSPACES) {
  console.log(`\n→ npm pack -w ${ws} --dry-run`);
  const out = run(`npm pack -w ${ws} --dry-run`);

  if (/\.test\.(js|d\.ts)/.test(out)) {
    console.error(`✗ ${ws}: tarball lists test artifacts — fix tsconfig exclude or clean dist`);
    failed = true;
  }

  if (/\*"/.test(out) || /: "\*"/.test(out)) {
    console.error(`✗ ${ws}: workspace "*" dependency detected in pack output`);
    failed = true;
  }

  const sizeMatch = out.match(/package size: ([\d.]+ \w+)/);
  const filesMatch = out.match(/total files: (\d+)/);
  console.log(
    `✓ ${ws}${filesMatch ? ` — ${filesMatch[1]} files` : ''}${sizeMatch ? `, ${sizeMatch[1]}` : ''}`,
  );
}

if (failed) {
  process.exit(1);
}

console.log('\n✓ pack:check passed for all publish workspaces');
