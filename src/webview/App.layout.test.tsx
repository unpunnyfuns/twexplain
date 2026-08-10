import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import type { ExplainedClass, PanelState } from '../types'
import { App } from './App'

const row = (text: string, index: number): ExplainedClass => ({
  candidate: { text, range: { start: 0, end: text.length }, index },
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
  groups: [{ name: 'spacing', classes: [row('px-4', 0), row('gap-2', 1)] }],
  palette: [],
  variants: [],
}

async function mount() {
  const vscode = { postMessage: vi.fn() }
  const screen = await render(<App vscode={vscode} />)
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'state', state: ready } }))
  await expect.element(screen.getByRole('banner')).toBeVisible()
  return { screen, vscode }
}

async function openCombobox(screen: Awaited<ReturnType<typeof mount>>['screen']) {
  await screen.getByRole('button', { name: /add a class/i }).click()
  await expect.element(screen.getByRole('combobox')).toBeVisible()
}

const suggest = (matches: string[]): void => {
  window.dispatchEvent(
    new MessageEvent('message', { data: { type: 'suggestions', query: 'gap', matches } }),
  )
}

describe('the suggestion list floats', () => {
  it('overlays the classes rather than pushing them down', async () => {
    const { screen } = await mount()
    await openCombobox(screen)
    await screen.getByRole('combobox').fill('gap')

    const heading = screen.getByRole('heading', { name: 'spacing' })
    await expect.element(heading).toBeVisible()
    const before = (await heading.element()).getBoundingClientRect().top

    suggest(['gap-2', 'gap-4', 'gap-8'])
    await expect.element(screen.getByRole('option', { name: 'gap-2' })).toBeVisible()

    const after = (await heading.element()).getBoundingClientRect().top
    expect(after).toBe(before)
  })

  it('is taken out of flow, so it can sit on top', async () => {
    const { screen } = await mount()

    await openCombobox(screen)
    await screen.getByRole('combobox').fill('gap')
    suggest(['gap-2'])
    await expect.element(screen.getByRole('listbox')).toBeVisible()
    const list = await screen.getByRole('listbox').element()

    expect(getComputedStyle(list).position).toBe('absolute')
  })

  it('paints over what is underneath rather than letting it show through', async () => {
    const { screen } = await mount()

    await openCombobox(screen)
    await screen.getByRole('combobox').fill('gap')
    suggest(['gap-2'])
    await expect.element(screen.getByRole('listbox')).toBeVisible()
    const list = await screen.getByRole('listbox').element()

    expect(getComputedStyle(list).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  })
})

describe('the header icons sit on the right', () => {
  it('puts add and undo at the right-hand edge', async () => {
    const { screen } = await mount()
    const header = await screen.getByRole('banner').element()
    const add = await screen.getByRole('button', { name: /add a class/i }).element()
    const undo = await screen.getByRole('button', { name: /undo last edit/i }).element()

    const headerRight = header.getBoundingClientRect().right
    expect(headerRight - undo.getBoundingClientRect().right).toBeLessThan(16)
    expect(add.getBoundingClientRect().left).toBeGreaterThan(
      header.getBoundingClientRect().width / 2,
    )
  })

  it('keeps the icons on the right once the combobox opens', async () => {
    const { screen } = await mount()

    await openCombobox(screen)

    const input = await screen.getByRole('combobox').element()
    const add = await screen.getByRole('button', { name: /add a class/i }).element()

    expect(add.getBoundingClientRect().left).toBeGreaterThan(
      input.getBoundingClientRect().right - 1,
    )
  })
})
