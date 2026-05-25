#!/usr/bin/env node
import { execSync } from 'node:child_process';

const SCOPED_PACKAGES = [
  '@pixelagent/shared',
  '@pixelagent/mcp',
  '@pixelagent/cli',
];

function tryRun(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim();
  } catch {
    return null;
  }
}

const user = tryRun('npm whoami');
if (!user) {
  console.error('✗ Not logged in to npm.');
  console.error('  Run: npm login');
  console.error('  Then re-run: npm run publish:check-scope');
  process.exit(1);
}

console.log(`✓ npm user: ${user}`);

const access = tryRun('npm access ls-packages @pixelagent 2>/dev/null');
if (access) {
  console.log('✓ @pixelagent scope access:');
  console.log(access.split('\n').map((line) => `    ${line}`).join('\n'));
} else {
  console.warn('⚠ Could not list @pixelagent packages.');
  console.warn('  Ensure your npm account owns or is a member of the @pixelagent org.');
  console.warn('  Create org: https://www.npmjs.com/org/create');
  console.warn('  Or publish once with: npm publish --access public -w @pixelagent/shared');
}

for (const name of SCOPED_PACKAGES) {
  const existing = tryRun(`npm view ${name} version 2>/dev/null`);
  if (existing) {
    console.warn(`⚠ ${name} already exists on npm @ ${existing}`);
  } else {
    console.log(`✓ ${name} — not published yet (name available)`);
  }
}

const pixelagent = tryRun('npm view pixelagent version 2>/dev/null');
if (pixelagent) {
  console.warn(`⚠ pixelagent already exists on npm @ ${pixelagent}`);
} else {
  console.log('✓ pixelagent — not published yet (name available)');
}

console.log('\nScope check complete. Run npm run pack:check before publish.');
