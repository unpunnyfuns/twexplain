import { defineConfig } from '@vscode/test-cli'

export default defineConfig({
  files: 'out/integration/**/*.integration.test.js',
  workspaceFolder: './src/integration/__fixtures__/workspace',
  mocha: { timeout: 30000 },
})
