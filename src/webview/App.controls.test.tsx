import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import type { ExplainedClass, PanelState } from '../types'
import { App } from './App'

const row = (text: string, index: number, numericValue: number | null): ExplainedClass => ({
  candidate: { text, range: { start: 0, end: text.length }, index },
  valid: true,
  declarations: [],
  prose: 'something',
  group: 'spacing',
  variants: [],
  swatch: null,
  numericValue,
})

const ready: PanelState = {
  status: 'ready',
  groups: [{ name: 'spacing', classes: [row('px-4', 0, 4), row('flex', 1, null)] }],
  palette: [],
}

async function mount() {
  const vscode = { postMessage: vi.fn() }
  const screen = await render(<App vscode={vscode} />)
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'state', state: ready } }))
  return { screen, vscode }
}

describe('App forwards edit intents to the host', () => {
  it('posts an edit message when a stepper is clicked', async () => {
    const { screen, vscode } = await mount()

    await screen.getByRole('button', { name: 'increase px-4' }).click()

    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: 'edit',
      intent: { type: 'step', index: 0, delta: 1 },
    })
  })

  it('posts an edit message when a class is removed', async () => {
    const { screen, vscode } = await mount()

    await screen.getByRole('button', { name: 'remove flex' }).click()

    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: 'edit',
      intent: { type: 'remove', index: 1 },
    })
  })

  it('still announces itself as ready on mount', async () => {
    const { vscode } = await mount()

    expect(vscode.postMessage).toHaveBeenCalledWith({ type: 'ready' })
  })

  it('renders a notice before any state arrives', async () => {
    const vscode = { postMessage: vi.fn() }
    const screen = await render(<App vscode={vscode} />)

    await expect.element(screen.getByText(/put your cursor inside a classname/i)).toBeVisible()
  })
})
