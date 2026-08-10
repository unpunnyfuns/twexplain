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

describe('choosing a suggestion from the keyboard', () => {
  const list = ['gap-2', 'gap-4', 'gap-8']

  async function open(onPick = vi.fn()) {
    const screen = await render(
      <AddClass value="gap" suggestions={list} onChange={vi.fn()} onPick={onPick} />,
    )
    await screen.getByRole('combobox', { name: /class to add/i }).click()
    return { screen, onPick }
  }

  it('starts with the first suggestion active', async () => {
    const { screen } = await open()

    await expect
      .element(screen.getByRole('option', { name: 'gap-2' }))
      .toHaveAttribute('aria-selected', 'true')
  })

  it('moves down the list with the down arrow', async () => {
    const { screen } = await open()

    await userEvent.keyboard('{ArrowDown}')

    await expect
      .element(screen.getByRole('option', { name: 'gap-4' }))
      .toHaveAttribute('aria-selected', 'true')
  })

  it('picks whichever suggestion the arrows landed on', async () => {
    const { screen, onPick } = await open()

    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onPick).toHaveBeenCalledWith('gap-8')
    await expect.element(screen.getByRole('combobox')).toBeVisible()
  })

  it('moves back up with the up arrow', async () => {
    const { onPick } = await open()

    await userEvent.keyboard('{ArrowDown}{ArrowUp}{Enter}')

    expect(onPick).toHaveBeenCalledWith('gap-2')
  })

  it('wraps from the last suggestion to the first', async () => {
    const { onPick } = await open()

    await userEvent.keyboard('{ArrowUp}{Enter}')

    expect(onPick).toHaveBeenCalledWith('gap-8')
  })

  it('keeps focus in the input, so typing continues to narrow the list', async () => {
    const { screen } = await open()

    await userEvent.keyboard('{ArrowDown}')

    await expect.element(screen.getByRole('combobox')).toHaveFocus()
  })

  it('tells assistive technology which option is active', async () => {
    const { screen } = await open()

    await userEvent.keyboard('{ArrowDown}')
    const input = await screen.getByRole('combobox').element()
    const active = document.getElementById(input.getAttribute('aria-activedescendant') ?? '')

    expect(active?.textContent).toBe('gap-4')
  })

  it('starts again from the top when the suggestions change', async () => {
    const onPick = vi.fn()
    const screen = await render(
      <AddClass value="gap" suggestions={list} onChange={vi.fn()} onPick={onPick} />,
    )
    await screen.getByRole('combobox').click()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')

    await screen.rerender(
      <AddClass value="p" suggestions={['p-1', 'p-2']} onChange={vi.fn()} onPick={onPick} />,
    )
    await userEvent.keyboard('{Enter}')

    expect(onPick).toHaveBeenCalledWith('p-1')
  })

  it('puts the options directly in the listbox, with no element in between', async () => {
    const { screen } = await open()
    const listbox = await screen.getByRole('listbox').element()
    const option = await screen.getByRole('option', { name: 'gap-2' }).element()

    expect(option.parentElement).toBe(listbox)
  })
})
