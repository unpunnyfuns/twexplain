import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import type { ExplainedClass, PanelState } from '../types'
import { App } from './App'

const row = (text: string, index: number, numericValue: number | null): ExplainedClass => ({
  candidate: { text, range: { start: 0, end: text.length }, index },
  valid: true,
  root: null,
  declarations: [],
  prose: 'something',
  condition: null,
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

    await screen.getByRole('button', { name: /details for px-4/i }).click()
    await screen.getByRole('button', { name: 'increase px-4' }).click()

    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: 'edit',
      intent: { type: 'step', index: 0, delta: 1 },
    })
  })

  it('posts an edit message when a class is removed', async () => {
    const { screen, vscode } = await mount()

    await screen.getByRole('button', { name: /details for flex/i }).click()
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

async function openAdd(screen: Awaited<ReturnType<typeof mount>>['screen']): Promise<void> {
  await screen.getByRole('button', { name: /add a class/i }).click()
}

describe('App add-class flow', () => {
  it('asks the host to search once the typing settles', async () => {
    const { screen, vscode } = await mount()
    await openAdd(screen)

    await screen.getByRole('combobox', { name: /class to add/i }).fill('gap')
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(vscode.postMessage).toHaveBeenCalledWith({ type: 'search', query: 'gap' })
  })

  it('does not ask once per keystroke', async () => {
    const { screen, vscode } = await mount()
    await openAdd(screen)

    await screen.getByRole('combobox', { name: /class to add/i }).fill('gap')
    await new Promise((resolve) => setTimeout(resolve, 200))

    const searches = vscode.postMessage.mock.calls.filter(
      ([message]) => (message as { type: string }).type === 'search',
    )
    expect(searches).toHaveLength(1)
  })

  it('shows suggestions the host returns for the current query', async () => {
    const { screen } = await mount()
    await openAdd(screen)

    await screen.getByRole('combobox', { name: /class to add/i }).fill('gap')
    await new Promise((resolve) => setTimeout(resolve, 200))
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'suggestions', query: 'gap', matches: ['gap-2', 'gap-4'] },
      }),
    )

    await expect.element(screen.getByRole('option', { name: 'gap-2' })).toBeVisible()
  })

  it('discards suggestions for a query the user has moved on from', async () => {
    const { screen } = await mount()
    await openAdd(screen)

    await screen.getByRole('combobox', { name: /class to add/i }).fill('gap')
    await new Promise((resolve) => setTimeout(resolve, 200))
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'suggestions', query: 'px', matches: ['px-4'] },
      }),
    )

    expect(screen.getByRole('option', { name: 'px-4' }).elements()).toHaveLength(0)
  })

  it('posts an add intent when a suggestion is picked', async () => {
    const { screen, vscode } = await mount()
    await openAdd(screen)

    await screen.getByRole('combobox', { name: /class to add/i }).fill('gap')
    await new Promise((resolve) => setTimeout(resolve, 200))
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
    await openAdd(screen)

    await screen.getByRole('combobox', { name: /class to add/i }).fill('gap')
    await new Promise((resolve) => setTimeout(resolve, 200))
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'suggestions', query: 'gap', matches: ['gap-2'] },
      }),
    )
    await screen.getByRole('option', { name: 'gap-2' }).click()

    await expect.element(screen.getByRole('combobox', { name: /class to add/i })).toHaveValue('')
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

describe('App remembers the design-system payload', () => {
  const readyWith = (
    palette: { name: string; value: string }[],
    variants: string[],
  ): PanelState => ({
    status: 'ready',
    groups: [{ name: 'color', classes: [colourRow()] }],
    palette,
    variants,
  })

  function colourRow(): ExplainedClass {
    return {
      candidate: { text: 'bg-blue-600', range: { start: 0, end: 11 }, index: 0 },
      valid: true,
      root: null,
      declarations: [{ prop: 'background-color', value: 'blue' }],
      prose: 'background blue',
      condition: null,
      group: 'color',
      variants: [],
      swatch: 'blue',
      numericValue: null,
      modifier: null,
      arbitraryValue: null,
    }
  }

  const send = (state: PanelState): void => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'state', state } }))
  }

  it('keeps the palette when a later state omits it', async () => {
    const vscode = { postMessage: vi.fn() }
    const screen = await render(<App vscode={vscode} />)

    send(readyWith([{ name: 'red-500', value: 'red' }], ['hover']))
    await screen.getByRole('button', { name: /details for bg-blue-600/i }).click()
    await expect.element(screen.getByRole('button', { name: 'red-500' })).toBeVisible()

    send(readyWith([], []))
    await expect.element(screen.getByRole('button', { name: 'red-500' })).toBeVisible()
  })

  it('replaces the palette when a later state supplies a new one', async () => {
    const vscode = { postMessage: vi.fn() }
    const screen = await render(<App vscode={vscode} />)

    send(readyWith([{ name: 'red-500', value: 'red' }], ['hover']))
    send(readyWith([{ name: 'blue-500', value: 'blue' }], ['focus']))
    await screen.getByRole('button', { name: /details for bg-blue-600/i }).click()

    await expect.element(screen.getByRole('button', { name: 'blue-500' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'red-500' }).elements()).toHaveLength(0)
  })
})
