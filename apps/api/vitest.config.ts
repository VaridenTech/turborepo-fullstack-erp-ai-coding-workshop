import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    // Integration scenarios need Postgres: `pnpm test:integration` runs them.
    exclude: ['**/node_modules/**', 'src/**/*.integration.spec.ts'],
  },
});
