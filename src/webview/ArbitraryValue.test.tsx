import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { ArbitraryValue } from './ArbitraryValue'

describe('ArbitraryValue', () => {
  it('shows the current arbitrary value', async () => {
    const screen = await render(<ArbitraryValue index={0} value="13px" onIntent={vi.fn()} />)

    await expect
      .element(screen.getByRole('textbox', { name: /arbitrary value/i }))
      .toHaveValue('13px')
  })

  it('commits a new value on Enter', async () => {
    const onIntent = vi.fn()
    const screen = await render(<ArbitraryValue index={4} value="13px" onIntent={onIntent} />)

    await screen.getByRole('textbox', { name: /arbitrary value/i }).fill('20px')
    await userEvent.keyboard('{Enter}')

    expect(onIntent).toHaveBeenCalledWith({ type: 'setValue', index: 4, value: '[20px]' })
  })

  it('does not commit while the user is still typing', async () => {
    const onIntent = vi.fn()
    const screen = await render(<ArbitraryValue index={0} value="13px" onIntent={onIntent} />)

    await screen.getByRole('textbox', { name: /arbitrary value/i }).fill('20p')

    expect(onIntent).not.toHaveBeenCalled()
  })

  it('does not commit an unchanged value', async () => {
    const onIntent = vi.fn()
    const screen = await render(<ArbitraryValue index={0} value="13px" onIntent={onIntent} />)

    await screen.getByRole('textbox', { name: /arbitrary value/i }).click()
    await userEvent.keyboard('{Enter}')

    expect(onIntent).not.toHaveBeenCalled()
  })

  it('does not commit an empty value', async () => {
    const onIntent = vi.fn()
    const screen = await render(<ArbitraryValue index={0} value="13px" onIntent={onIntent} />)

    await screen.getByRole('textbox', { name: /arbitrary value/i }).fill('')
    await userEvent.keyboard('{Enter}')

    expect(onIntent).not.toHaveBeenCalled()
  })
})
