import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import type { ExplainedClass, PanelState } from '../types'
import { App } from './App'

const row = (text: string): ExplainedClass => ({
  candidate: { text, range: { start: 0, end: text.length }, index: 0 },
  valid: true,
  root: null,
  declarations: [],
  prose: 'something',
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

const addButton = (screen: Awaited<ReturnType<typeof mount>>['screen']) =>
  screen.getByRole('button', { name: /add a class/i })

describe('the panel header', () => {
  it('offers add and undo once a class string is selected', async () => {
    const { screen } = await mount()

    await expect.element(addButton(screen)).toBeVisible()
    await expect.element(screen.getByRole('button', { name: /undo last edit/i })).toBeVisible()
  })

  it('is absent before a class string is selected', async () => {
    const { screen } = await mount({ status: 'no-selection' })

    expect(screen.getByRole('button', { name: /add a class/i }).elements()).toHaveLength(0)
    expect(screen.getByRole('button', { name: /undo last edit/i }).elements()).toHaveLength(0)
  })

  it('sits in a banner so it stays put while the classes scroll', async () => {
    const { screen } = await mount()

    await expect.element(screen.getByRole('banner')).toBeVisible()
  })
})

describe('the add button expands the combobox', () => {
  it('keeps the combobox out of the way until asked for', async () => {
    const { screen } = await mount()

    expect(screen.getByRole('combobox').elements()).toHaveLength(0)
    await expect.element(addButton(screen)).toHaveAttribute('aria-expanded', 'false')
  })

  it('reveals the combobox when add is used', async () => {
    const { screen } = await mount()

    await addButton(screen).click()

    await expect.element(screen.getByRole('combobox')).toBeVisible()
    await expect.element(addButton(screen)).toHaveAttribute('aria-expanded', 'true')
  })

  it('puts the cursor in the combobox, so you can type straight away', async () => {
    const { screen } = await mount()

    await addButton(screen).click()

    await expect.element(screen.getByRole('combobox')).toHaveFocus()
  })

  it('collapses again on a second press', async () => {
    const { screen } = await mount()

    await addButton(screen).click()
    await addButton(screen).click()

    expect(screen.getByRole('combobox').elements()).toHaveLength(0)
  })

  it('closes on Escape without adding anything', async () => {
    const { screen, vscode } = await mount()

    await addButton(screen).click()
    await screen.getByRole('combobox').fill('gap')
    await userEscape()

    expect(screen.getByRole('combobox').elements()).toHaveLength(0)
    expect(vscode.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'edit' }) as never,
    )
  })

  it('forgets what was typed, so reopening starts clean', async () => {
    const { screen } = await mount()

    await addButton(screen).click()
    await screen.getByRole('combobox').fill('gap')
    await userEscape()
    await addButton(screen).click()

    await expect.element(screen.getByRole('combobox')).toHaveValue('')
  })
})

describe('undo in the header', () => {
  it('asks the host to undo', async () => {
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
})

async function userEscape(): Promise<void> {
  const { userEvent } = await import('vitest/browser')
  await userEvent.keyboard('{Escape}')
}
