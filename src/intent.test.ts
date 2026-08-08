import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoadResult } from './design-system/load'
import { resolveIntent } from './intent'
import type { EditIntent } from './intent'

const loadDesignSystem = vi.hoisted(() => vi.fn())

vi.mock('./design-system/load', () => ({
  loadDesignSystem,
  clearDesignSystemCache: vi.fn(),
}))

type Candidate = {
  root: string
  value?: { kind: string; value: string } | null
  modifier?: { kind: string; value: string } | null
  variants: { kind: string; root?: string }[]
}

const named = (value: string) => ({ kind: 'named', value })

const SHAPES: Record<string, Candidate> = {
  flex: { root: 'flex', value: null, modifier: null, variants: [] },
  'gap-2': { root: 'gap', value: named('2'), modifier: null, variants: [] },
  'px-4': { root: 'px', value: named('4'), modifier: null, variants: [] },
  'bg-blue-600': { root: 'bg', value: named('blue-600'), modifier: null, variants: [] },
}

const ds = {
  parseCandidate: (text: string) => {
    const shape = SHAPES[text]
    return shape === undefined ? [] : [shape]
  },
  printCandidate: (candidate: unknown) => {
    const c = candidate as Candidate
    const prefix = c.variants
      .map((v) => v.root)
      .reverse()
      .map((r) => `${r}:`)
      .join('')
    const body = c.value ? `${c.root}-${c.value.value}` : c.root
    return `${prefix}${body}${c.modifier ? `/${c.modifier.value}` : ''}`
  },
  parseVariant: (text: string) => ({ kind: 'static', root: text }),
  candidatesToCss: (cs: string[]) => cs.map(() => null),
  printVariant: (v: unknown) => (v as { root?: string }).root ?? '',
  resolveThemeValue: () => undefined,
  theme: { namespace: () => new Map<string, string>() },
  getClassList: () => [] as [string, unknown][],
  getVariants: () => [] as { name: string }[],
}

const SOURCE = '<div className="flex gap-2 px-4">x</div>'

const base = {
  text: SOURCE,
  offset: SOURCE.indexOf('gap-2'),
  uri: 'file:///a.tsx',
  fsPath: '/a.tsx',
  workspaceRoot: '/ws',
  languageId: 'typescriptreact',
}

const apply = (edit: { start: number; end: number; newText: string } | null): string =>
  edit === null ? SOURCE : SOURCE.slice(0, edit.start) + edit.newText + SOURCE.slice(edit.end)

const run = (intent: EditIntent, offset = base.offset) => resolveIntent({ ...base, offset, intent })

beforeEach(() => {
  loadDesignSystem.mockReset()
  loadDesignSystem.mockResolvedValue({ ok: true, entry: '/ws/app.css', ds } as LoadResult)
})

describe('resolveIntent', () => {
  it('steps a numeric value', async () => {
    expect(apply(await run({ type: 'step', index: 1, delta: 1 }))).toBe(
      '<div className="flex gap-3 px-4">x</div>',
    )
  })

  it('sets a value', async () => {
    const offset = SOURCE.indexOf('px-4')
    expect(apply(await run({ type: 'setValue', index: 2, value: '8' }, offset))).toBe(
      '<div className="flex gap-2 px-8">x</div>',
    )
  })

  it('adds a variant to one candidate only', async () => {
    expect(apply(await run({ type: 'addVariant', index: 1, variant: 'hover' }))).toBe(
      '<div className="flex hover:gap-2 px-4">x</div>',
    )
  })

  it('removes a candidate', async () => {
    expect(apply(await run({ type: 'remove', index: 1 }))).toBe(
      '<div className="flex px-4">x</div>',
    )
  })

  it('adds a class at the end', async () => {
    expect(apply(await run({ type: 'add', text: 'm-2' }))).toBe(
      '<div className="flex gap-2 px-4 m-2">x</div>',
    )
  })

  it('returns null when the cursor is not in a class string', async () => {
    expect(await run({ type: 'step', index: 1, delta: 1 }, 2)).toBeNull()
  })

  it('returns null when the design system is unavailable', async () => {
    loadDesignSystem.mockResolvedValue({ ok: false, reason: 'no-tailwind' } as LoadResult)
    expect(await run({ type: 'step', index: 1, delta: 1 })).toBeNull()
  })

  it('returns null when the mutation is not applicable', async () => {
    expect(await run({ type: 'step', index: 0, delta: 1 }, SOURCE.indexOf('flex'))).toBeNull()
  })

  it('does not need the design system to remove a class', async () => {
    loadDesignSystem.mockResolvedValue({ ok: false, reason: 'no-tailwind' } as LoadResult)
    expect(apply(await run({ type: 'remove', index: 1 }))).toBe(
      '<div className="flex px-4">x</div>',
    )
  })
})
