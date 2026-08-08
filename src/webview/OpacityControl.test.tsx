import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { OPACITY_STEPS, OpacityControl } from './OpacityControl'

describe('OpacityControl', () => {
  it('offers each opacity step', async () => {
    const screen = await render(<OpacityControl index={0} modifier={null} onIntent={vi.fn()} />)

    for (const step of OPACITY_STEPS) {
      const label = step === null ? 'full opacity' : `${step}% opacity`
      await expect.element(screen.getByRole('button', { name: label })).toBeVisible()
    }
  })

  it('asks to set a modifier when a step is chosen', async () => {
    const onIntent = vi.fn()
    const screen = await render(<OpacityControl index={7} modifier={null} onIntent={onIntent} />)

    await screen.getByRole('button', { name: '50% opacity' }).click()

    expect(onIntent).toHaveBeenCalledWith({ type: 'setModifier', index: 7, modifier: '50' })
  })

  it('clears the modifier when full opacity is chosen', async () => {
    const onIntent = vi.fn()
    const screen = await render(<OpacityControl index={7} modifier="50" onIntent={onIntent} />)

    await screen.getByRole('button', { name: 'full opacity' }).click()

    expect(onIntent).toHaveBeenCalledWith({ type: 'setModifier', index: 7, modifier: null })
  })

  it('marks the current step as pressed', async () => {
    const screen = await render(<OpacityControl index={0} modifier="50" onIntent={vi.fn()} />)

    await expect
      .element(screen.getByRole('button', { name: '50% opacity' }))
      .toHaveAttribute('aria-pressed', 'true')
    await expect
      .element(screen.getByRole('button', { name: 'full opacity' }))
      .toHaveAttribute('aria-pressed', 'false')
  })

  it('treats no modifier as full opacity', async () => {
    const screen = await render(<OpacityControl index={0} modifier={null} onIntent={vi.fn()} />)

    await expect
      .element(screen.getByRole('button', { name: 'full opacity' }))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a modifier the steps do not cover, so it can be seen and changed', async () => {
    const screen = await render(<OpacityControl index={0} modifier="37" onIntent={vi.fn()} />)

    await expect
      .element(screen.getByRole('button', { name: '37% opacity' }))
      .toHaveAttribute('aria-pressed', 'true')
  })
})
