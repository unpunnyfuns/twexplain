import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import type { PaletteColor } from '../types'
import { ColorPicker } from './ColorPicker'

const palette: PaletteColor[] = [
  { name: 'blue-500', value: 'oklch(62% 0.21 260)' },
  { name: 'blue-600', value: 'oklch(55% 0.22 262)' },
  { name: 'red-500', value: 'oklch(64% 0.24 25)' },
  { name: 'brand-600', value: '#4f46e5' },
]

describe('ColorPicker', () => {
  it('offers every colour in the workspace palette', async () => {
    const screen = await render(
      <ColorPicker index={0} current="blue-600" palette={palette} onIntent={vi.fn()} />,
    )

    for (const color of palette) {
      await expect.element(screen.getByRole('button', { name: color.name })).toBeVisible()
    }
  })

  it('asks to set the chosen colour on the right candidate', async () => {
    const onIntent = vi.fn()
    const screen = await render(
      <ColorPicker index={4} current="blue-600" palette={palette} onIntent={onIntent} />,
    )

    await screen.getByRole('button', { name: 'red-500' }).click()

    expect(onIntent).toHaveBeenCalledWith({ type: 'setValue', index: 4, value: 'red-500' })
  })

  it('offers custom theme colours alongside the defaults', async () => {
    const onIntent = vi.fn()
    const screen = await render(
      <ColorPicker index={0} current="blue-600" palette={palette} onIntent={onIntent} />,
    )

    await screen.getByRole('button', { name: 'brand-600' }).click()

    expect(onIntent).toHaveBeenCalledWith({ type: 'setValue', index: 0, value: 'brand-600' })
  })

  it('marks the current colour as pressed', async () => {
    const screen = await render(
      <ColorPicker index={0} current="blue-600" palette={palette} onIntent={vi.fn()} />,
    )

    await expect
      .element(screen.getByRole('button', { name: 'blue-600' }))
      .toHaveAttribute('aria-pressed', 'true')
    await expect
      .element(screen.getByRole('button', { name: 'red-500' }))
      .toHaveAttribute('aria-pressed', 'false')
  })

  it('paints each swatch with its authored value and names it in the title', async () => {
    const screen = await render(
      <ColorPicker index={0} current="blue-600" palette={palette} onIntent={vi.fn()} />,
    )

    await expect
      .element(screen.getByRole('button', { name: 'brand-600' }))
      .toHaveAttribute('title', 'brand-600 — #4f46e5')
  })

  it('renders nothing when the palette is empty', async () => {
    const screen = await render(
      <ColorPicker index={0} current="blue-600" palette={[]} onIntent={vi.fn()} />,
    )

    expect(screen.getByRole('button').elements()).toHaveLength(0)
  })
})
