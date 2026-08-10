import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { clearDesignSystemCache } from './design-system/load'
import { resolveSort } from './sort'

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

async function sorted(text: string, needle: string): Promise<string> {
  const edit = await resolveSort({
    ...base,
    text,
    offset: text.indexOf(needle) + 1,
    uri: 'file:///a.tsx',
    languageId: 'typescriptreact',
  })
  if (edit === null) return text
  return text.slice(0, edit.start) + edit.newText + text.slice(edit.end)
}

describe('resolveSort against the real design system', () => {
  it('sorts a class string into the order Tailwind generates', async () => {
    const text = '<div className="text-white p-4 flex bg-blue-600" />'

    expect(await sorted(text, 'text-white')).toBe(
      '<div className="flex bg-blue-600 p-4 text-white" />',
    )
  })

  it('settles, so sorting an already sorted string changes nothing', async () => {
    const once = await sorted('<div className="text-white p-4 flex" />', 'text-white')

    expect(await sorted(once, 'flex')).toBe(once)
  })

  it('puts variants after the plain utilities they modify', async () => {
    const text = '<div className="md:flex hover:bg-blue-700 flex" />'

    expect(await sorted(text, 'md:flex')).toBe('<div className="flex hover:bg-blue-700 md:flex" />')
  })

  it('keeps a class Tailwind does not know, rather than dropping it', async () => {
    const text = '<div className="p-4 my-widget flex" />'
    const result = await sorted(text, 'p-4')

    expect(result).toContain('my-widget')
    expect(result).toBe('<div className="my-widget flex p-4" />')
  })

  it('keeps a wrapped class string wrapped', async () => {
    const text = '<div\n  className="text-white\n    p-4\n    flex"\n/>'

    expect(await sorted(text, 'text-white')).toBe(
      '<div\n  className="flex\n    p-4\n    text-white"\n/>',
    )
  })
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
