import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { AddClass } from './AddClass'

describe('AddClass', () => {
  it('reports what the user typed so the host can search', async () => {
    const onChange = vi.fn()
    const screen = await render(
      <AddClass value="" suggestions={[]} onChange={onChange} onPick={vi.fn()} />,
    )

    await screen.getByRole('combobox', { name: /class to add/i }).fill('gap')

    expect(onChange).toHaveBeenCalledWith('gap')
  })

  it('lists the suggestions it was given', async () => {
    const screen = await render(
      <AddClass value="gap" suggestions={['gap-2', 'gap-4']} onChange={vi.fn()} onPick={vi.fn()} />,
    )

    await expect.element(screen.getByRole('option', { name: 'gap-2' })).toBeVisible()
    await expect.element(screen.getByRole('option', { name: 'gap-4' })).toBeVisible()
  })

  it('picks a suggestion when clicked', async () => {
    const onPick = vi.fn()
    const screen = await render(
      <AddClass value="gap" suggestions={['gap-2', 'gap-4']} onChange={vi.fn()} onPick={onPick} />,
    )

    await screen.getByRole('option', { name: 'gap-4' }).click()

    expect(onPick).toHaveBeenCalledWith('gap-4')
  })

  it('picks the first suggestion on Enter', async () => {
    const onPick = vi.fn()
    const screen = await render(
      <AddClass value="gap" suggestions={['gap-2', 'gap-4']} onChange={vi.fn()} onPick={onPick} />,
    )

    await screen.getByRole('combobox', { name: /class to add/i }).click()
    await userEvent.keyboard('{Enter}')

    expect(onPick).toHaveBeenCalledWith('gap-2')
  })

  it('does nothing on Enter when there is nothing to pick', async () => {
    const onPick = vi.fn()
    const screen = await render(
      <AddClass value="zzz" suggestions={[]} onChange={vi.fn()} onPick={onPick} />,
    )

    await screen.getByRole('combobox', { name: /class to add/i }).click()
    await userEvent.keyboard('{Enter}')

    expect(onPick).not.toHaveBeenCalled()
  })

  it('shows no list when there are no suggestions', async () => {
    const screen = await render(
      <AddClass value="" suggestions={[]} onChange={vi.fn()} onPick={vi.fn()} />,
    )

    expect(screen.getByRole('option').elements()).toHaveLength(0)
  })
})
