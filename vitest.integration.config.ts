import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'src/design-system/load.integration.test.ts',
      'src/explain/golden.integration.test.ts',
      'src/explain/curation.integration.test.ts',
      'src/edit/mutate.integration.test.ts',
      'src/search.integration.test.ts',
      'src/sort.integration.test.ts',
    ],
    environment: 'node',
  },
})
