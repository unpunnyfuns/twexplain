import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoadResult } from './design-system/load'
import { computeState } from './state'

const loadDesignSystem = vi.hoisted(() => vi.fn())

vi.mock('./design-system/load', () => ({
  loadDesignSystem,
  clearDesignSystemCache: vi.fn(),
}))

const base = {
  text: '<div className="flex">x</div>',
  offset: 17,
  uri: 'file:///a.tsx',
  fsPath: '/a.tsx',
  workspaceRoot: '/ws',
  languageId: 'typescriptreact',
}

const givenLoad = (result: LoadResult): void => {
  loadDesignSystem.mockResolvedValue(result)
}

beforeEach(() => {
  loadDesignSystem.mockReset()
})

describe('computeState', () => {
  it('reports no-selection when the cursor is outside a class string', async () => {
    const state = await computeState({ ...base, offset: 2 })
    expect(state.status).toBe('no-selection')
    expect(loadDesignSystem).not.toHaveBeenCalled()
  })

  it('reports no-workspace-tailwind when there is no workspace root', async () => {
    const state = await computeState({ ...base, workspaceRoot: null })
    expect(state.status).toBe('no-workspace-tailwind')
    expect(loadDesignSystem).not.toHaveBeenCalled()
  })

  it('reports no-workspace-tailwind when the workspace has no Tailwind', async () => {
    givenLoad({ ok: false, reason: 'no-tailwind' })
    expect((await computeState(base)).status).toBe('no-workspace-tailwind')
  })

  it('surfaces the version it found when the major is unsupported', async () => {
    givenLoad({ ok: false, reason: 'wrong-version', detail: '3.4.17' })
    expect(await computeState(base)).toEqual({ status: 'wrong-version', found: '3.4.17' })
  })

  it('reports no-css-entry when no entry stylesheet was found', async () => {
    givenLoad({ ok: false, reason: 'no-entry' })
    expect((await computeState(base)).status).toBe('no-css-entry')
  })

  it('reports the unsupported-plugin state distinctly from a load error', async () => {
    givenLoad({ ok: false, reason: 'unsupported-plugin' })
    expect((await computeState(base)).status).toBe('unsupported-plugin')
  })

  it('carries the detail through on a load error', async () => {
    givenLoad({ ok: false, reason: 'error', detail: 'boom' })
    expect(await computeState(base)).toEqual({ status: 'load-error', message: 'boom' })
  })

  it('does not leave the message empty when a load error has no detail', async () => {
    givenLoad({ ok: false, reason: 'error' })
    const state = await computeState(base)
    expect(state.status).toBe('load-error')
    if (state.status !== 'load-error') return
    expect(state.message.length).toBeGreaterThan(0)
  })

  it('explains the class string when the design system loads', async () => {
    givenLoad({
      ok: true,
      entry: '/ws/src/app.css',
      ds: {
        candidatesToCss: () => ['.flex { display: flex; }'],
        parseCandidate: () => [{ root: 'flex', variants: [] }],
        printVariant: () => '',
        resolveThemeValue: () => undefined,
        printCandidate: () => 'flex',
        parseVariant: () => ({ kind: 'static', root: 'hover' }),
        theme: { namespace: () => new Map() },
        getClassList: () => [],
        getVariants: () => [],
      },
    })

    const state = await computeState(base)
    expect(state.status).toBe('ready')
    if (state.status !== 'ready') return
    expect(state.groups.flatMap((g) => g.classes).map((c) => c.candidate.text)).toEqual(['flex'])
  })
})

describe('computeState stale runtime', () => {
  it('tells the user to reload rather than reporting a generic load error', async () => {
    givenLoad({ ok: false, reason: 'stale-runtime', detail: 'loaded 4.1.0, now 4.2.0' })
    expect((await computeState(base)).status).toBe('stale-runtime')
  })
})

describe('computeState palette', () => {
  const withTheme = (colors: [string, string][]) => ({
    ok: true as const,
    entry: '/ws/src/app.css',
    ds: {
      candidatesToCss: () => ['.flex { display: flex; }'],
      parseCandidate: () => [{ root: 'flex', variants: [] }],
      printVariant: () => '',
      resolveThemeValue: () => undefined,
      printCandidate: () => 'flex',
      parseVariant: () => ({ kind: 'static', root: 'hover' }),
      theme: { namespace: () => new Map(colors) },
      getClassList: () => [],
      getVariants: () => [],
    },
  })

  it('carries the workspace palette so the picker can offer real colours', async () => {
    givenLoad(
      withTheme([
        ['blue-600', 'oklch(1 2 3)'],
        ['brand-600', '#4f46e5'],
      ]) as never,
    )
    const state = await computeState(base)

    expect(state.status).toBe('ready')
    if (state.status !== 'ready') return
    expect(state.palette).toEqual([
      { name: 'blue-600', value: 'oklch(1 2 3)' },
      { name: 'brand-600', value: '#4f46e5' },
    ])
  })

  it('includes custom @theme colours, not just Tailwind defaults', async () => {
    givenLoad(withTheme([['brand-600', '#4f46e5']]) as never)
    const state = await computeState(base)

    if (state.status !== 'ready') throw new Error('expected ready')
    expect(state.palette.map((c) => c.name)).toContain('brand-600')
  })

  it('reports an empty palette rather than failing when the theme has no colours', async () => {
    givenLoad(withTheme([]) as never)
    const state = await computeState(base)

    if (state.status !== 'ready') throw new Error('expected ready')
    expect(state.palette).toEqual([])
  })
})

describe('computeState variants', () => {
  const withVariants = (names: string[]) => ({
    ok: true as const,
    entry: '/ws/src/app.css',
    ds: {
      candidatesToCss: () => ['.flex { display: flex; }'],
      parseCandidate: () => [{ root: 'flex', variants: [] }],
      printVariant: () => '',
      resolveThemeValue: () => undefined,
      printCandidate: () => 'flex',
      parseVariant: () => ({ kind: 'static', root: 'hover' }),
      theme: { namespace: () => new Map() },
      getClassList: () => [],
      getVariants: () => names.map((name) => ({ name })),
    },
  })

  it('carries the workspace variant names', async () => {
    givenLoad(withVariants(['hover', 'focus', 'md', '2xl']) as never)
    const state = await computeState(base)

    if (state.status !== 'ready') throw new Error('expected ready')
    expect(state.variants).toEqual(['hover', 'focus', 'md', '2xl'])
  })

  it('reports an empty list rather than failing when there are none', async () => {
    givenLoad(withVariants([]) as never)
    const state = await computeState(base)

    if (state.status !== 'ready') throw new Error('expected ready')
    expect(state.variants).toEqual([])
  })
})
