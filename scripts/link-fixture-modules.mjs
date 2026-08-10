import { lstat, mkdir, rm, symlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspace = join(repoRoot, 'src', 'integration', '__fixtures__', 'workspace')
const modules = join(workspace, 'node_modules')

function locateTailwind() {
  const require = createRequire(join(repoRoot, 'index.js'))
  try {
    return dirname(require.resolve('tailwindcss/package.json'))
  } catch {
    return join(repoRoot, 'node_modules', 'tailwindcss')
  }
}

const existing = await lstat(modules).catch(() => null)
if (existing?.isSymbolicLink()) await rm(modules, { force: true })

await mkdir(modules, { recursive: true })

const link = join(modules, 'tailwindcss')
await rm(link, { recursive: true, force: true })
await symlink(locateTailwind(), link, 'junction')

console.log(`linked tailwindcss into ${workspace}`)
