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
