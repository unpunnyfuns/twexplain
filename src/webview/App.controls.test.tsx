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
  modifier: null,
  arbitraryValue: null,
})

const ready: PanelState = {
  status: 'ready',
  groups: [{ name: 'spacing', classes: [row('px-4', 0, 4), row('flex', 1, null)] }],
  palette: [],
  variants: [],
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

describe('App add-class flow', () => {
  it('asks the host to search as the user types', async () => {
    const { screen, vscode } = await mount()

    await screen.getByRole('combobox', { name: /add a class/i }).fill('gap')

    expect(vscode.postMessage).toHaveBeenCalledWith({ type: 'search', query: 'gap' })
  })

  it('shows suggestions the host returns for the current query', async () => {
    const { screen } = await mount()

    await screen.getByRole('combobox', { name: /add a class/i }).fill('gap')
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'suggestions', query: 'gap', matches: ['gap-2', 'gap-4'] },
      }),
    )

    await expect.element(screen.getByRole('option', { name: 'gap-2' })).toBeVisible()
  })

  it('discards suggestions for a query the user has moved on from', async () => {
    const { screen } = await mount()

    await screen.getByRole('combobox', { name: /add a class/i }).fill('gap')
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'suggestions', query: 'px', matches: ['px-4'] },
      }),
    )

    expect(screen.getByRole('option', { name: 'px-4' }).elements()).toHaveLength(0)
  })

  it('posts an add intent when a suggestion is picked', async () => {
    const { screen, vscode } = await mount()

    await screen.getByRole('combobox', { name: /add a class/i }).fill('gap')
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'suggestions', query: 'gap', matches: ['gap-2'] },
      }),
    )
    await screen.getByRole('option', { name: 'gap-2' }).click()

    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: 'edit',
      intent: { type: 'add', text: 'gap-2' },
    })
  })

  it('clears the query after adding, so the next search starts fresh', async () => {
    const { screen } = await mount()

    await screen.getByRole('combobox', { name: /add a class/i }).fill('gap')
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'suggestions', query: 'gap', matches: ['gap-2'] },
      }),
    )
    await screen.getByRole('option', { name: 'gap-2' }).click()

    await expect.element(screen.getByRole('combobox', { name: /add a class/i })).toHaveValue('')
  })
})

describe('App undo affordance', () => {
  it('asks the host to undo when the button is used', async () => {
    const { screen, vscode } = await mount()

    await screen.getByRole('button', { name: /undo last edit/i }).click()

    expect(vscode.postMessage).toHaveBeenCalledWith({ type: 'undo' })
  })

  it('names the editor shortcut so it is clear which undo this is', async () => {
    const { screen } = await mount()

    await expect
      .element(screen.getByRole('button', { name: /undo last edit/i }))
      .toHaveAttribute('title', 'Runs the editor’s own undo, the same as ⌘Z')
  })

  it('offers no undo before a class string is selected', async () => {
    const vscode = { postMessage: vi.fn() }
    const screen = await render(<App vscode={vscode} />)

    expect(screen.getByRole('button', { name: /undo last edit/i }).elements()).toHaveLength(0)
  })
})
