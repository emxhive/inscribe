import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@inscribe/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    root: path.resolve(__dirname, '../..'),
    environment: 'node',
    include: ['apps/desktop/src/**/*.test.ts'],
    exclude: ['legacy/**', '**/node_modules/**'],
  },
});
