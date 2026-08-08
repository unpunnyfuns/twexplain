import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { COMMON_VARIANTS, VariantChips } from './VariantChips'

describe('VariantChips', () => {
  it('offers the common variants as toggles', async () => {
    const screen = await render(<VariantChips index={0} variants={[]} onIntent={vi.fn()} />)

    for (const variant of COMMON_VARIANTS) {
      await expect.element(screen.getByRole('button', { name: variant, exact: true })).toBeVisible()
    }
  })

  it('asks to add a variant the class does not have', async () => {
    const onIntent = vi.fn()
    const screen = await render(<VariantChips index={2} variants={[]} onIntent={onIntent} />)

    await screen.getByRole('button', { name: 'hover', exact: true }).click()

    expect(onIntent).toHaveBeenCalledWith({ type: 'addVariant', index: 2, variant: 'hover' })
  })

  it('asks to remove a variant the class already has', async () => {
    const onIntent = vi.fn()
    const screen = await render(<VariantChips index={2} variants={['hover']} onIntent={onIntent} />)

    await screen.getByRole('button', { name: 'hover', exact: true }).click()

    expect(onIntent).toHaveBeenCalledWith({ type: 'removeVariant', index: 2, variant: 'hover' })
  })

  it('marks the active variants as pressed', async () => {
    const screen = await render(<VariantChips index={0} variants={['md']} onIntent={vi.fn()} />)

    await expect
      .element(screen.getByRole('button', { name: 'md', exact: true }))
      .toHaveAttribute('aria-pressed', 'true')
    await expect
      .element(screen.getByRole('button', { name: 'hover', exact: true }))
      .toHaveAttribute('aria-pressed', 'false')
  })

  it('also shows a variant the class has that is not in the common set', async () => {
    const screen = await render(
      <VariantChips index={0} variants={['data-[state=open]']} onIntent={vi.fn()} />,
    )

    await expect
      .element(screen.getByRole('button', { name: 'data-[state=open]', exact: true }))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('does not duplicate a variant that is both active and common', async () => {
    const screen = await render(<VariantChips index={0} variants={['hover']} onIntent={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'hover', exact: true }).elements()).toHaveLength(1)
  })
})
