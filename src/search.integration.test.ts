import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { clearDesignSystemCache } from './design-system/load'
import { MAX_SUGGESTIONS, searchClasses } from './search'

let input: { workspaceRoot: string; fsPath: string }

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'twexplain-search-'))
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
  input = { workspaceRoot: root, fsPath: join(root, 'src', 'App.tsx') }
})

describe('searchClasses against the real class list', () => {
  it('finds a common utility', async () => {
    expect(await searchClasses(input, 'gap-2')).toContain('gap-2')
  })

  it('offers classes generated from a custom theme colour', async () => {
    expect(await searchClasses(input, 'brand')).toContain('bg-brand-600')
  })

  it('ranks the exact prefix first', async () => {
    const results = await searchClasses(input, 'flex')
    expect(results[0]).toBe('flex')
  })

  it('never returns more than the cap even for a very broad query', async () => {
    expect((await searchClasses(input, 'e')).length).toBeLessThanOrEqual(MAX_SUGGESTIONS)
  })

  it('returns nothing for a query no class contains', async () => {
    expect(await searchClasses(input, 'definitelynotaclass')).toEqual([])
  })
})

describe('the real design system exposes what the panel needs', () => {
  it('lists variants including breakpoints and states', async () => {
    const { loadDesignSystem } = await import('./design-system/load')
    const loaded = await loadDesignSystem(input.workspaceRoot, input.fsPath)
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    const names = Array.from(loaded.ds.getVariants(), (v) => v.name)
    expect(names).toContain('hover')
    expect(names).toContain('focus')
    expect(names).toContain('dark')
    expect(names.length).toBeGreaterThan(50)
  })
})
