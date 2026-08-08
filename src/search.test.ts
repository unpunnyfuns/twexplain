import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_SUGGESTIONS, searchClasses } from './search'

const loadDesignSystem = vi.hoisted(() => vi.fn())

vi.mock('./design-system/load', () => ({
  loadDesignSystem,
  clearDesignSystemCache: vi.fn(),
}))

const CLASS_LIST: [string, unknown][] = [
  ['gap-2', {}],
  ['gap-4', {}],
  ['flex-gap', {}],
  ['col-gap-2', {}],
  ['flex', {}],
  ['px-4', {}],
]

const givenClasses = (list: [string, unknown][] = CLASS_LIST): void => {
  loadDesignSystem.mockResolvedValue({
    ok: true,
    entry: '/ws/app.css',
    ds: { getClassList: () => list },
  })
}

const base = { workspaceRoot: '/ws', fsPath: '/a.tsx' }

beforeEach(() => {
  loadDesignSystem.mockReset()
  givenClasses()
})

describe('searchClasses', () => {
  it('finds classes containing the query', async () => {
    expect(await searchClasses(base, 'gap')).toContain('gap-2')
  })

  it('ranks prefix matches before mid-string matches', async () => {
    const results = await searchClasses(base, 'gap')

    expect(results.indexOf('gap-2')).toBeLessThan(results.indexOf('flex-gap'))
    expect(results.indexOf('gap-4')).toBeLessThan(results.indexOf('col-gap-2'))
  })

  it('returns nothing for an empty query rather than the whole list', async () => {
    expect(await searchClasses(base, '')).toEqual([])
    expect(await searchClasses(base, '   ')).toEqual([])
  })

  it('ignores case', async () => {
    expect(await searchClasses(base, 'GAP')).toContain('gap-2')
  })

  it('caps the number of suggestions', async () => {
    const many: [string, unknown][] = Array.from({ length: 500 }, (_, i) => [`gap-${i}`, {}])
    givenClasses(many)

    expect(await searchClasses(base, 'gap')).toHaveLength(MAX_SUGGESTIONS)
  })

  it('returns nothing when the design system is unavailable', async () => {
    loadDesignSystem.mockResolvedValue({ ok: false, reason: 'no-tailwind' })

    expect(await searchClasses(base, 'gap')).toEqual([])
  })

  it('returns nothing without a workspace root', async () => {
    expect(await searchClasses({ workspaceRoot: null, fsPath: '/a.tsx' }, 'gap')).toEqual([])
    expect(loadDesignSystem).not.toHaveBeenCalled()
  })

  it('does not match a query no class contains', async () => {
    expect(await searchClasses(base, 'zzzz')).toEqual([])
  })
})
