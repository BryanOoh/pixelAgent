#!/usr/bin/env node
import { runSetup } from './setup.js';

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'setup':
    case undefined:
      await runSetup(process.cwd());
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Usage: npx pixelagent setup');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('PixelAgent setup failed:', error);
  process.exit(1);
});
