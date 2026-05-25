import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'PixelAgent',
      formats: ['es'],
      fileName: 'pixelagent',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', '@pixelagent/shared'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    sourcemap: true,
  },
});
