import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { clearDesignSystemCache, loadDesignSystem } from '../design-system/load'
import type { EditPort } from './mutate'
import { addVariant, setModifier, setValue, stepValue } from './mutate'

let root: string
let port: EditPort
let ds: {
  candidatesToCss(c: string[]): (string | null)[]
  printCandidate(c: unknown): string
  parseCandidate(c: string): unknown[]
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'twexplain-mutate-'))
  await mkdir(join(root, 'src'), { recursive: true })
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await symlink(
    join(process.cwd(), 'node_modules', 'tailwindcss'),
    join(root, 'node_modules', 'tailwindcss'),
    'dir',
  )
  await writeFile(join(root, 'src', 'app.css'), '@import "tailwindcss";\n')
  clearDesignSystemCache()

  const loaded = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))
  if (!loaded.ok) throw new Error('design system failed to load')
  ds = loaded.ds as never
  port = ds as never
})

describe('mutation against the real design system', () => {
  it('produces the expected candidate text for each mutation', () => {
    expect(setValue('bg-blue-600', 'blue-700', port)).toBe('bg-blue-700')
    expect(stepValue('px-4', 2, port)).toBe('px-6')
    expect(setModifier('bg-blue-600', '50', port)).toBe('bg-blue-600/50')
    expect(addVariant('flex', 'hover', port)).toBe('hover:flex')
  })

  it('leaves the design system uncorrupted, so explanations stay truthful', () => {
    const cssBefore = ds.candidatesToCss(['bg-blue-600'])[0]

    setValue('bg-blue-600', 'red-500', port)
    setModifier('bg-blue-600', '25', port)
    addVariant('bg-blue-600', 'focus', port)
    stepValue('px-4', 5, port)

    expect(ds.candidatesToCss(['bg-blue-600'])[0]).toBe(cssBefore)
    expect(ds.printCandidate(ds.parseCandidate('bg-blue-600')[0])).toBe('bg-blue-600')
    expect(ds.printCandidate(ds.parseCandidate('px-4')[0])).toBe('px-4')
  })
})

describe('the validation guard against real Tailwind', () => {
  async function write(candidate: string, variant: string): Promise<string | null> {
    const { resolveIntent } = await import('../intent')
    const source = `<div className="${candidate}" />`
    try {
      const edit = await resolveIntent({
        text: source,
        offset: source.indexOf(candidate) + 1,
        uri: 'file:///a.tsx',
        workspaceRoot: root,
        fsPath: join(root, 'src', 'App.tsx'),
        languageId: 'typescriptreact',
        intent: { type: 'addVariant', index: 0, variant },
      })
      return edit?.newText ?? null
    } catch (error) {
      return error instanceof Error ? `refused: ${error.message}` : 'refused'
    }
  }

  it('writes a variant Tailwind can compile', async () => {
    expect(await write('rounded', 'hover')).toBe('hover:rounded')
  })

  it('refuses a variant that cannot stand on its own, rather than writing it', async () => {
    const result = await write('border-slate-600', '@max')

    expect(result).toContain('refused')
  })
})
