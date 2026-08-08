// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExplainedClass, PanelState } from '../types'
import { App } from './App'

afterEach(cleanup)

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
}

function mount() {
  const vscode = { postMessage: vi.fn() }
  render(<App vscode={vscode} />)
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'state', state: ready } }))
  })
  return vscode
}

describe('App forwards edit intents to the host', () => {
  it('posts an edit message when a stepper is clicked', () => {
    const vscode = mount()
    fireEvent.click(screen.getByRole('button', { name: /increase px-4/i }))

    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: 'edit',
      intent: { type: 'step', index: 0, delta: 1 },
    })
  })

  it('posts an edit message when a class is removed', () => {
    const vscode = mount()
    fireEvent.click(screen.getByRole('button', { name: /remove flex/i }))

    expect(vscode.postMessage).toHaveBeenCalledWith({
      type: 'edit',
      intent: { type: 'remove', index: 1 },
    })
  })

  it('still announces itself as ready on mount', () => {
    const vscode = mount()
    expect(vscode.postMessage).toHaveBeenCalledWith({ type: 'ready' })
  })
})
