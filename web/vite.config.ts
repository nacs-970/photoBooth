import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  resolve: {
    alias: {
      $lib: '/src/lib',
    },
    ...(process.env.VITEST ? { conditions: ['browser'] } : {}),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest-setup.ts'],
    passWithNoTests: true,
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)', '**/*.test.svelte.ts'],
  },
});
