import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pixelagentVitePlugin } from '@pixelagent/mcp/vite-plugin';
import { pixelagentSourcePlugin } from '@pixelagent/mcp/source-plugin';
import { resolve } from 'path';

const monorepoRoot = resolve(__dirname, '../..');

export default defineConfig({
  plugins: [
    // Must run before `@vitejs/plugin-react` so we annotate JSX before
    // react-refresh / TSX transform reshape it.
    pixelagentSourcePlugin({ projectRoot: monorepoRoot }),
    react(),
    pixelagentVitePlugin({ projectRoot: monorepoRoot }),
  ],
  resolve: {
    alias: {
      '@pixelagent/shared': resolve(__dirname, '../shared/src/index.ts'),
      pixelagent: resolve(__dirname, '../pixelagent/src/index.tsx'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
