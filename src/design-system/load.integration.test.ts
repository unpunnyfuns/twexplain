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

  it('refuses @config rather than loading a design system missing whatever it defines', async () => {
    const configRoot = await workspace('@import "tailwindcss";\n@config "./tw.config.js";\n', [
      'tw.config.js',
      'module.exports = { theme: { extend: { colors: { mine: "#123456" } } } }\n',
    ])
    const result = await loadDesignSystem(configRoot, join(configRoot, 'src', 'App.tsx'))

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('unsupported-config')
  })

  it('still loads a project using @custom-variant, which does work', async () => {
    const variantRoot = await workspace(
      '@import "tailwindcss";\n@custom-variant hocus (&:hover, &:focus);\n',
    )
    const result = await loadDesignSystem(variantRoot, join(variantRoot, 'src', 'App.tsx'))

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.ds.candidatesToCss(['hocus:flex'])[0]).not.toBeNull()
  })
})

describe('loadDesignSystem across a Tailwind version change', () => {
  it('reports a stale runtime rather than silently rebuilding against the old module', async () => {
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

    expect(second.ok).toBe(false)
    if (second.ok) return
    expect(second.reason).toBe('stale-runtime')
    expect(second.detail).toContain('4.2.0')
  })

  it('keeps reporting stale until the cache is cleared and the version settles', async () => {
    const settleRoot = await mkdtemp(join(tmpdir(), 'twexplain-settle-'))
    await mkdir(join(settleRoot, 'src'), { recursive: true })
    await mkdir(join(settleRoot, 'node_modules', 'tailwindcss'), { recursive: true })

    const realTailwind = join(process.cwd(), 'node_modules', 'tailwindcss')
    for (const name of ['dist', 'index.css', 'preflight.css', 'theme.css', 'utilities.css']) {
      await symlink(join(realTailwind, name), join(settleRoot, 'node_modules', 'tailwindcss', name))
    }

    const manifest = join(settleRoot, 'node_modules', 'tailwindcss', 'package.json')
    await writeFile(join(settleRoot, 'src', 'app.css'), '@import "tailwindcss";\n')
    const activeFile = join(settleRoot, 'src', 'App.tsx')

    clearDesignSystemCache()
    await writeFile(manifest, JSON.stringify({ version: '4.1.0' }))
    expect((await loadDesignSystem(settleRoot, activeFile)).ok).toBe(true)

    await writeFile(manifest, JSON.stringify({ version: '4.9.9' }))
    expect((await loadDesignSystem(settleRoot, activeFile)).ok).toBe(false)

    await writeFile(manifest, JSON.stringify({ version: '4.1.0' }))
    expect((await loadDesignSystem(settleRoot, activeFile)).ok).toBe(true)
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

describe('individual per-layer imports', () => {
  it("loads a design system from Tailwind's documented per-layer import setup", async () => {
    const individualRoot = await mkdtemp(join(tmpdir(), 'twexplain-individual-'))
    await mkdir(join(individualRoot, 'src'), { recursive: true })
    await mkdir(join(individualRoot, 'node_modules'), { recursive: true })
    await symlink(
      join(process.cwd(), 'node_modules', 'tailwindcss'),
      join(individualRoot, 'node_modules', 'tailwindcss'),
      'dir',
    )
    await writeFile(
      join(individualRoot, 'src', 'app.css'),
      [
        '@layer theme, base, components, utilities;',
        '@import "tailwindcss/theme.css" layer(theme);',
        '@import "tailwindcss/utilities.css" layer(utilities);',
        '@theme { --color-brand-600: #4f46e5; }',
      ].join('\n'),
    )
    clearDesignSystemCache()

    const loaded = await loadDesignSystem(individualRoot, join(individualRoot, 'src', 'App.tsx'))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    expect(loaded.ds.candidatesToCss(['px-4'])[0]).toContain('padding-inline')
    expect(loaded.ds.resolveThemeValue('--color-brand-600')).toBe('#4f46e5')
  })
})
