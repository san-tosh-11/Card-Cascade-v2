import { defineConfig } from 'vitest/config';

// Unit + handler tests run in plain Node (no browser, no running server needed).
export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
