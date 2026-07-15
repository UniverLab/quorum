import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
  },
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/pages/**', 'src/main.js', 'src/background.js', 'src/banner.js', 'src/theme.js'],
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
      },
    },
  },
});
