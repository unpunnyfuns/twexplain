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
