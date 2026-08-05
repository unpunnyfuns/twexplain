import { describe, expect, it } from 'vitest'
import { computeState } from './state'

const base = {
  text: '<div className="flex">x</div>',
  offset: 17,
  uri: 'file:///a.tsx',
  fsPath: '/a.tsx',
}

describe('computeState', () => {
  it('reports no-selection when the cursor is outside a class string', async () => {
    const state = await computeState({ ...base, offset: 2, workspaceRoot: '/tmp/none' })
    expect(state.status).toBe('no-selection')
  })

  it('reports no-workspace-tailwind when there is no workspace root', async () => {
    const state = await computeState({ ...base, workspaceRoot: null })
    expect(state.status).toBe('no-workspace-tailwind')
  })
})
