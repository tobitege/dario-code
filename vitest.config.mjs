import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.mjs'],
    exclude: ['tests/integration.test.mjs', 'node_modules/**'],
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 10000
  }
})
