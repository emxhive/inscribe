import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      '@inscribe/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),

    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  base: './',
  build: {
    outDir: 'dist/renderer',
  },
});
