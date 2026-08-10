const { copyFile, mkdir } = require('node:fs/promises')
const { dirname, join } = require('node:path')

const esbuild = require('esbuild')

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

const shared = {
  bundle: true,
  minify: production,
  sourcemap: !production,
  logLevel: 'info',
}

const configs = [
  {
    ...shared,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    format: 'cjs',
    platform: 'node',
    external: ['vscode'],
  },
  {
    ...shared,
    entryPoints: ['src/webview/index.tsx'],
    outfile: 'dist/webview.js',
    format: 'iife',
    platform: 'browser',
    loader: { '.module.css': 'local-css' },
  },
]

async function copyCodicons() {
  const from = dirname(require.resolve('@vscode/codicons/package.json'))
  await mkdir('dist', { recursive: true })
  for (const file of ['codicon.css', 'codicon.ttf']) {
    await copyFile(join(from, 'dist', file), join('dist', file))
  }
}

async function main() {
  await copyCodicons()

  if (watch) {
    const ctxs = await Promise.all(configs.map((c) => esbuild.context(c)))
    await Promise.all(ctxs.map((c) => c.watch()))
    return
  }
  await Promise.all(configs.map((c) => esbuild.build(c)))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
