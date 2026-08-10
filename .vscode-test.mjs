import { defineConfig } from '@vscode/test-cli'

export default defineConfig({
  files: 'out/integration/**/*.integration.test.js',
  workspaceFolder: '.',
  mocha: { timeout: 30000 },
})
