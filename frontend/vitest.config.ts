import { defineConfig } from 'vitest/config'
import path from 'path'

/**
 * Standalone from vite.config.ts on purpose: that config installs a plugin
 * which reads the VITE_* env and throws when it finds a secret-shaped value.
 * That check belongs to the build, not to a unit-test run, and it would make
 * `npm run test` fail for reasons unrelated to the tests.
 */
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    // htmlToGrid parses clipboard HTML with DOMParser.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
