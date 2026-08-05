const esbuild = require('esbuild')

esbuild
  .build({
    entryPoints: ['src/integration/panel.integration.test.ts'],
    outfile: 'out/integration/panel.integration.test.js',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['vscode'],
    sourcemap: true,
    logLevel: 'info',
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
