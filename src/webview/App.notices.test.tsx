import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import type { PanelState } from '../types'
import { App } from './App'

const STATES: PanelState[] = [
  { status: 'no-workspace-tailwind' },
  { status: 'wrong-version', found: '3.4.1' },
  { status: 'no-css-entry' },
  { status: 'unsupported-plugin' },
  { status: 'stale-runtime' },
  { status: 'load-error', message: 'ENOENT: app.css' },
  { status: 'loading' },
  { status: 'no-selection' },
]

async function show(state: PanelState) {
  const screen = await render(<App vscode={{ postMessage: vi.fn() }} />)
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'state', state } }))
  return screen
}

describe('every state the host can report', () => {
  it.each(STATES.map((state) => [state.status, state] as const))(
    'says something about %s rather than showing a blank panel',
    async (_status, state) => {
      const screen = await show(state)
      const notice = screen.getByRole('paragraph')

      await expect.element(notice.first()).toBeVisible()
      expect((await notice.first().element()).textContent?.trim().length ?? 0).toBeGreaterThan(20)
    },
  )

  it('shows exactly one notice, not a stack of them', async () => {
    const screen = await show({ status: 'no-css-entry' })

    expect(screen.getByRole('paragraph').elements()).toHaveLength(1)
  })
})

describe('notices that can name a fix, name it', () => {
  it('tells you to install Tailwind when the workspace has none', async () => {
    const screen = await show({ status: 'no-workspace-tailwind' })

    await expect.element(screen.getByText(/install tailwindcss/i)).toBeVisible()
  })

  it('tells you which import to add when no entry stylesheet was found', async () => {
    const screen = await show({ status: 'no-css-entry' })

    await expect.element(screen.getByText(/@import "tailwindcss"/)).toBeVisible()
  })

  it('names the version found when it is not v4', async () => {
    const screen = await show({ status: 'wrong-version', found: '3.4.1' })

    await expect.element(screen.getByText(/3\.4\.1/)).toBeVisible()
  })

  it('passes the underlying failure through rather than hiding it', async () => {
    const screen = await show({ status: 'load-error', message: 'ENOENT: app.css' })

    await expect.element(screen.getByText(/ENOENT: app\.css/)).toBeVisible()
  })
})
