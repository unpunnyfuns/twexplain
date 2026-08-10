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

    expect(onIntent).toHaveBeenCalledWith({ type: 'setValue', index: 4, value: '20px' })
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

describe('the draft follows the class it is editing', () => {
  it('shows the new value when the row is reused for a different class', async () => {
    const screen = await render(<ArbitraryValue index={0} value="13px" onIntent={vi.fn()} />)
    await expect.element(screen.getByRole('textbox')).toHaveValue('13px')

    await screen.rerender(<ArbitraryValue index={0} value="99px" onIntent={vi.fn()} />)

    await expect.element(screen.getByRole('textbox')).toHaveValue('99px')
  })

  it('never sends a value the row is no longer showing', async () => {
    const onIntent = vi.fn()
    const screen = await render(<ArbitraryValue index={0} value="13px" onIntent={onIntent} />)
    await screen.rerender(<ArbitraryValue index={0} value="99px" onIntent={onIntent} />)

    const { userEvent } = await import('vitest/browser')
    await screen.getByRole('textbox').click()
    await userEvent.keyboard('{Enter}')

    expect(onIntent).not.toHaveBeenCalledWith(expect.objectContaining({ value: '13px' }) as never)
  })
})

describe('the value it sends is the value Tailwind expects', () => {
  it('sends the value without brackets, since printing adds them', async () => {
    const onIntent = vi.fn()
    const screen = await render(<ArbitraryValue index={0} value="12px" onIntent={onIntent} />)

    await screen.getByRole('textbox').fill('20px')
    await screen.getByRole('textbox').click()
    const { userEvent } = await import('vitest/browser')
    await userEvent.keyboard('{Enter}')

    expect(onIntent).toHaveBeenCalledWith({ type: 'setValue', index: 0, value: '20px' })
  })

  it('sends exactly what was typed, without guessing at brackets', async () => {
    const onIntent = vi.fn()
    const screen = await render(<ArbitraryValue index={0} value="12px" onIntent={onIntent} />)

    await screen.getByRole('textbox').fill('[20px]')
    await screen.getByRole('textbox').click()
    const { userEvent } = await import('vitest/browser')
    await userEvent.keyboard('{Enter}')

    expect(onIntent).toHaveBeenCalledWith({ type: 'setValue', index: 0, value: '[20px]' })
  })

  it('leaves brackets that belong to the value itself alone', async () => {
    const onIntent = vi.fn()
    const screen = await render(<ArbitraryValue index={0} value="a" onIntent={onIntent} />)

    await screen.getByRole('textbox').fill('calc(100%-1rem)')
    await screen.getByRole('textbox').click()
    const { userEvent } = await import('vitest/browser')
    await userEvent.keyboard('{Enter}')

    expect(onIntent).toHaveBeenCalledWith({
      type: 'setValue',
      index: 0,
      value: 'calc(100%-1rem)',
    })
  })
})

describe('a value whose own brackets are part of the CSS', () => {
  async function commit(shown: string, typed: string) {
    const onIntent = vi.fn()
    const screen = await render(<ArbitraryValue index={0} value={shown} onIntent={onIntent} />)
    await screen.getByRole('textbox').fill(typed)
    await screen.getByRole('textbox').click()
    const { userEvent } = await import('vitest/browser')
    await userEvent.keyboard('{Enter}')
    return onIntent
  }

  it('keeps grid line names intact', async () => {
    const onIntent = await commit('1fr', '[full-start] 1fr [full-end]')

    expect(onIntent).toHaveBeenCalledWith({
      type: 'setValue',
      index: 0,
      value: '[full-start] 1fr [full-end]',
    })
  })

  it('keeps a single bracketed line name intact', async () => {
    const onIntent = await commit('1fr', '[full-start]')

    expect(onIntent).toHaveBeenCalledWith({ type: 'setValue', index: 0, value: '[full-start]' })
  })

  it('cannot tell a hand-added wrap from a grid line name, so it changes neither', async () => {
    const onIntent = await commit('12px', '[20px]')

    expect(onIntent).toHaveBeenCalledWith({ type: 'setValue', index: 0, value: '[20px]' })
  })
})
