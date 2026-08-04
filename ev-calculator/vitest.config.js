import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.js',
    css: true,
    // EVChargingCalculatorDatabase.test.jsx loads the full 6 MB vehicle
    // database. Running files in parallel with it starves the other suites of
    // CPU and makes their userEvent interactions time out, so run one at a time.
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '*.config.js',
        'src/main.jsx',
      ],
    },
  },
});
