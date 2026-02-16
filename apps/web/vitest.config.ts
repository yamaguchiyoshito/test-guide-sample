import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/app/**',
        'src/api/**',
        'src/generated/**',
        '**/*.stories.tsx',
        '**/*.test.tsx',
        '**/*.spec.tsx',
        '**/types/**',
        '**/tests/**',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/tests': path.resolve(__dirname, './src/tests'),
      '@test-utils': path.resolve(__dirname, '../../packages/test-utils/src'),
    },
  },
});
