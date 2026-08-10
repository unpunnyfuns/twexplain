import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { ExplainedClass, PanelState } from '../types'
import { App } from './App'

const row = (text: string): ExplainedClass => ({
  candidate: { text, range: { start: 0, end: text.length }, index: 0 },
  valid: true,
  root: null,
  declarations: [],
  prose: 'something',
  condition: null,
  group: 'spacing',
  variants: [],
  swatch: null,
  numericValue: 4,
  modifier: null,
  arbitraryValue: null,
})

const ready: PanelState = {
  status: 'ready',
  groups: [{ name: 'spacing', classes: [row('px-4')] }],
  palette: [],
  variants: [],
}

async function mount(state: PanelState = ready) {
  const vscode = { postMessage: vi.fn() }
  const screen = await render(<App vscode={vscode} />)
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'state', state } }))
  return { screen, vscode }
}

const undoPosted = (vscode: { postMessage: ReturnType<typeof vi.fn> }): boolean =>
  vscode.postMessage.mock.calls.some(([message]) => (message as { type: string }).type === 'undo')

describe('the undo shortcut inside the panel', () => {
  it('asks the host to undo on Cmd+Z, which the webview would otherwise swallow', async () => {
    const { vscode } = await mount()

    await userEvent.keyboard('{Meta>}z{/Meta}')

    expect(undoPosted(vscode)).toBe(true)
  })

  it('works with Ctrl+Z, for people not on a Mac', async () => {
    const { vscode } = await mount()

    await userEvent.keyboard('{Control>}z{/Control}')

    expect(undoPosted(vscode)).toBe(true)
  })

  it('ignores a bare z, so it cannot fire while reading', async () => {
    const { vscode } = await mount()

    await userEvent.keyboard('z')

    expect(undoPosted(vscode)).toBe(false)
  })

  it('leaves Cmd+Shift+Z alone, since that is redo rather than undo', async () => {
    const { vscode } = await mount()

    await userEvent.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}')

    expect(undoPosted(vscode)).toBe(false)
  })

  it('does not fire before a class string is selected', async () => {
    const { vscode } = await mount({ status: 'no-selection' })

    await userEvent.keyboard('{Meta>}z{/Meta}')

    expect(undoPosted(vscode)).toBe(false)
  })

  it('leaves the combobox its own undo, rather than hijacking text editing', async () => {
    const { screen, vscode } = await mount()

    await screen.getByRole('button', { name: /add a class/i }).click()
    await screen.getByRole('combobox').fill('gap')
    await userEvent.keyboard('{Meta>}z{/Meta}')

    expect(undoPosted(vscode)).toBe(false)
  })
})
