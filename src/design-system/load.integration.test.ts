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

describe('loadDesignSystem with an unsupported @plugin', () => {
  const workspace = async (css: string, extra?: [string, string]): Promise<string> => {
    const pluginRoot = await mkdtemp(join(tmpdir(), 'twexplain-plugin-'))
    await mkdir(join(pluginRoot, 'src'), { recursive: true })
    await mkdir(join(pluginRoot, 'node_modules'), { recursive: true })
    await symlink(
      join(process.cwd(), 'node_modules', 'tailwindcss'),
      join(pluginRoot, 'node_modules', 'tailwindcss'),
      'dir',
    )
    await writeFile(join(pluginRoot, 'src', 'app.css'), css)
    if (extra !== undefined) await writeFile(join(pluginRoot, 'src', extra[0]), extra[1])
    clearDesignSystemCache()
    return pluginRoot
  }

  it('names the plugin as unsupported instead of leaking an internal error', async () => {
    const pluginRoot = await workspace(
      '@import "tailwindcss";\n@plugin "@tailwindcss/typography";\n',
    )
    const result = await loadDesignSystem(pluginRoot, join(pluginRoot, 'src', 'App.tsx'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unsupported-plugin')
  })

  it('detects a @plugin reached through an imported stylesheet', async () => {
    const pluginRoot = await workspace('@import "tailwindcss";\n@import "./plugins.css";\n', [
      'plugins.css',
      '@plugin "@tailwindcss/typography";\n',
    ])
    const result = await loadDesignSystem(pluginRoot, join(pluginRoot, 'src', 'App.tsx'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unsupported-plugin')
  })

  it('still loads directives that do work, such as @config and @custom-variant', async () => {
    const pluginRoot = await workspace(
      '@import "tailwindcss";\n@config "./tw.config.js";\n@custom-variant hocus (&:hover, &:focus);\n',
      ['tw.config.js', 'module.exports = {}\n'],
    )
    const result = await loadDesignSystem(pluginRoot, join(pluginRoot, 'src', 'App.tsx'))
    expect(result.ok).toBe(true)
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

describe('printVariant against the real design system', () => {
  it('returns non-empty text for every variant kind, including arbitrary ones', async () => {
    clearDesignSystemCache()
    const loaded = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    const cases: [string, string][] = [
      ['hover:flex', 'hover'],
      ['[&>*]:flex', '[&>*]'],
      ['group-hover:flex', 'group-hover'],
      ['data-[state=open]:flex', 'data-[state=open]'],
    ]

    for (const [candidate, expected] of cases) {
      const parsed = loaded.ds.parseCandidate(candidate)[0]
      expect(parsed, candidate).toBeDefined()
      if (parsed === undefined) continue
      const printed = parsed.variants.map((v) => loaded.ds.printVariant(v))
      expect(printed, candidate).toEqual([expected])
    }
  })

  it('reports stacked variants in reverse source order, which explainCandidates then flips', async () => {
    clearDesignSystemCache()
    const loaded = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    const parsed = loaded.ds.parseCandidate('md:hover:flex')[0]
    expect(parsed).toBeDefined()
    if (parsed === undefined) return
    expect(parsed.variants.map((v) => loaded.ds.printVariant(v))).toEqual(['hover', 'md'])
  })
})
