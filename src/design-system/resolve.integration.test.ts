import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearDesignSystemCache, loadDesignSystem } from './load'

const TAILWIND = join(process.cwd(), 'node_modules', 'tailwindcss')

async function workspace(): Promise<string> {
  clearDesignSystemCache()
  return mkdtemp(join(tmpdir(), 'twexplain-resolve-'))
}

async function installTailwind(at: string): Promise<void> {
  await mkdir(join(at, 'node_modules'), { recursive: true })
  await symlink(TAILWIND, join(at, 'node_modules', 'tailwindcss'), 'dir')
}

beforeEach(() => {
  clearDesignSystemCache()
})

describe('a project nested inside the workspace folder', () => {
  it('finds Tailwind beside the file rather than only at the workspace root', async () => {
    const root = await workspace()
    const app = join(root, 'apps', 'web')
    await mkdir(join(app, 'src'), { recursive: true })
    await installTailwind(app)
    await writeFile(join(app, 'src', 'app.css'), '@import "tailwindcss";\n')

    const loaded = await loadDesignSystem(root, join(app, 'src', 'App.tsx'))

    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.ds.candidatesToCss(['flex'])[0]).not.toBeNull()
  })

  it('prefers the nearest install when the workspace root has one too', async () => {
    const root = await workspace()
    const app = join(root, 'apps', 'web')
    await mkdir(join(app, 'src'), { recursive: true })
    await installTailwind(root)
    await installTailwind(app)
    await writeFile(
      join(app, 'src', 'app.css'),
      '@import "tailwindcss";\n@theme { --color-nested: #123456; }\n',
    )

    const loaded = await loadDesignSystem(root, join(app, 'src', 'App.tsx'))

    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.ds.candidatesToCss(['bg-nested'])[0]).not.toBeNull()
  })

  it('still reports no Tailwind when there is none anywhere above the file', async () => {
    const root = await workspace()
    await mkdir(join(root, 'src'), { recursive: true })
    await writeFile(join(root, 'src', 'app.css'), '@import "tailwindcss";\n')

    const loaded = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))

    expect(loaded.ok).toBe(false)
    if (loaded.ok) return
    expect(loaded.reason).toBe('no-tailwind')
  })
})

describe('a stylesheet imported from a package', () => {
  async function packagedStyles(): Promise<string> {
    const root = await workspace()
    await mkdir(join(root, 'src'), { recursive: true })
    await installTailwind(root)

    const pkg = join(root, 'node_modules', '@acme', 'styles')
    await mkdir(pkg, { recursive: true })
    await writeFile(
      join(pkg, 'package.json'),
      JSON.stringify({ name: '@acme/styles', version: '1.0.0' }),
    )
    await writeFile(join(pkg, 'theme.css'), '@theme { --color-acme: #abcdef; }\n')
    await writeFile(join(pkg, 'index.css'), '@theme { --color-acme-index: #fedcba; }\n')
    return root
  }

  it('resolves a scoped package subpath rather than failing with ENOENT', async () => {
    const root = await packagedStyles()
    await writeFile(
      join(root, 'src', 'app.css'),
      '@import "tailwindcss";\n@import "@acme/styles/theme.css";\n',
    )

    const loaded = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))

    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.ds.candidatesToCss(['bg-acme'])[0]).not.toBeNull()
  })

  it('resolves a bare package name to its index stylesheet', async () => {
    const root = await packagedStyles()
    await writeFile(
      join(root, 'src', 'app.css'),
      '@import "tailwindcss";\n@import "@acme/styles";\n',
    )

    const loaded = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))

    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.ds.candidatesToCss(['bg-acme-index'])[0]).not.toBeNull()
  })

  it('still resolves a relative import', async () => {
    const root = await packagedStyles()
    await writeFile(join(root, 'src', 'local.css'), '@theme { --color-local: #0f0f0f; }\n')
    await writeFile(
      join(root, 'src', 'app.css'),
      '@import "tailwindcss";\n@import "./local.css";\n',
    )

    const loaded = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))

    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return
    expect(loaded.ds.candidatesToCss(['bg-local'])[0]).not.toBeNull()
  })

  it('reports a genuinely missing import as an error rather than pretending', async () => {
    const root = await packagedStyles()
    await writeFile(
      join(root, 'src', 'app.css'),
      '@import "tailwindcss";\n@import "@acme/nope/missing.css";\n',
    )

    const loaded = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))

    expect(loaded.ok).toBe(false)
  })
})
