import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { clearDesignSystemCache, loadDesignSystem } from './load'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'twexplain-'))
  await mkdir(join(root, 'src'), { recursive: true })
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await symlink(
    join(process.cwd(), 'node_modules', 'tailwindcss'),
    join(root, 'node_modules', 'tailwindcss'),
    'dir',
  )
  await writeFile(
    join(root, 'src', 'app.css'),
    '@import "tailwindcss";\n@theme { --color-brand-600: #4f46e5; }\n',
  )
  clearDesignSystemCache()
})

describe('loadDesignSystem', () => {
  it('loads a real v4 design system and resolves custom theme values', async () => {
    const result = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.ds.candidatesToCss(['bg-brand-600'])[0]).toContain('--color-brand-600')
    expect(result.ds.resolveThemeValue('--color-brand-600')).toBe('#4f46e5')
    expect(result.ds.candidatesToCss(['nope-999'])[0]).toBeNull()
  })
})

describe('loadDesignSystem cache key', () => {
  it('does not reuse a cached design system when the reported Tailwind version changes', async () => {
    const versionedRoot = await mkdtemp(join(tmpdir(), 'twexplain-version-'))
    await mkdir(join(versionedRoot, 'src'), { recursive: true })
    await mkdir(join(versionedRoot, 'node_modules', 'tailwindcss'), { recursive: true })

    const realTailwind = join(process.cwd(), 'node_modules', 'tailwindcss')
    for (const name of ['dist', 'index.css', 'preflight.css', 'theme.css', 'utilities.css']) {
      await symlink(
        join(realTailwind, name),
        join(versionedRoot, 'node_modules', 'tailwindcss', name),
      )
    }

    const manifest = join(versionedRoot, 'node_modules', 'tailwindcss', 'package.json')
    const writeVersion = (version: string) => writeFile(manifest, JSON.stringify({ version }))

    await writeFile(join(versionedRoot, 'src', 'app.css'), '@import "tailwindcss";\n')

    const activeFile = join(versionedRoot, 'src', 'App.tsx')
    clearDesignSystemCache()

    await writeVersion('4.1.0')
    const first = await loadDesignSystem(versionedRoot, activeFile)
    expect(first.ok).toBe(true)

    const repeat = await loadDesignSystem(versionedRoot, activeFile)
    expect(repeat.ok).toBe(true)
    if (first.ok && repeat.ok) expect(repeat.ds).toBe(first.ds)

    await writeVersion('4.2.0')
    const second = await loadDesignSystem(versionedRoot, activeFile)
    expect(second.ok).toBe(true)

    if (!first.ok || !second.ok) return
    expect(second.ds).not.toBe(first.ds)
  })
})
