import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { clearDesignSystemCache } from './design-system/load'

let base: { workspaceRoot: string; fsPath: string }

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'twexplain-sort-'))
  await mkdir(join(root, 'src'), { recursive: true })
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await symlink(
    join(process.cwd(), 'node_modules', 'tailwindcss'),
    join(root, 'node_modules', 'tailwindcss'),
    'dir',
  )
  await writeFile(join(root, 'src', 'app.css'), '@import "tailwindcss";\n')
  clearDesignSystemCache()
  base = { workspaceRoot: root, fsPath: join(root, 'src', 'App.tsx') }
})

describe('breakpoints are mutually exclusive', () => {
  async function addVariantTo(text: string, variant: string): Promise<string> {
    const { resolveIntent } = await import('./intent')
    const source = `<div className="${text}" />`
    const edit = await resolveIntent({
      ...base,
      text: source,
      offset: source.indexOf(text) + 1,
      uri: 'file:///a.tsx',
      languageId: 'typescriptreact',
      intent: { type: 'addVariant', index: 0, variant },
    })
    if (edit === null) return source
    return source.slice(0, edit.start) + edit.newText + source.slice(edit.end)
  }

  it('replaces the breakpoint already on the class rather than stacking another', async () => {
    expect(await addVariantTo('md:rounded', 'lg')).toBe('<div className="lg:rounded" />')
  })

  it('cleans up a class that already stacked several', async () => {
    expect(await addVariantTo('sm:md:rounded', 'lg')).toBe('<div className="lg:rounded" />')
  })

  it('keeps variants that are not breakpoints, in the order Tailwind prints them', async () => {
    expect(await addVariantTo('hover:md:rounded', 'lg')).toBe(
      '<div className="lg:hover:rounded" />',
    )
  })

  it('leaves a min-and-max range alone, since that is legal', async () => {
    expect(await addVariantTo('max-md:rounded', 'sm')).toBe('<div className="sm:max-md:rounded" />')
  })

  it('adds a breakpoint normally when there is none', async () => {
    expect(await addVariantTo('rounded', 'lg')).toBe('<div className="lg:rounded" />')
  })
})
