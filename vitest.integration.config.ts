import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/design-system/load.integration.test.ts'],
    environment: 'node',
  },
})
