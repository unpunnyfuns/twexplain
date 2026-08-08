import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import type { ExplainedClass } from '../types'
import { ClassRow } from './ClassRow'

const explained = (overrides: Partial<ExplainedClass> = {}): ExplainedClass => ({
  candidate: { text: 'px-4', range: { start: 0, end: 4 }, index: 0 },
  valid: true,
  declarations: [{ prop: 'padding-inline', value: '16px' }],
  prose: 'padding of 16px on the left and right',
  group: 'spacing',
  variants: [],
  swatch: null,
  numericValue: 4,
  modifier: null,
  arbitraryValue: null,
  ...overrides,
})

describe('row layout', () => {
  it('shows the class name and its description', async () => {
    const screen = await render(<ClassRow explained={explained()} onIntent={vi.fn()} />)

    await expect.element(screen.getByText('px-4', { exact: true })).toBeVisible()
    await expect.element(screen.getByText(/padding of 16px/)).toBeVisible()
  })

  it('keeps the edit controls collapsed until asked for', async () => {
    const screen = await render(<ClassRow explained={explained()} onIntent={vi.fn()} />)

    await expect.element(screen.getByText(/details/i)).toBeVisible()
    expect(screen.getByRole('button', { name: 'increase px-4' }).elements()).toHaveLength(0)
  })

  it('reveals the controls when the details section is opened', async () => {
    const screen = await render(<ClassRow explained={explained()} onIntent={vi.fn()} />)

    await screen.getByText(/details/i).click()

    await expect.element(screen.getByRole('button', { name: 'increase px-4' })).toBeVisible()
  })

  it('keeps the raw CSS inside details rather than in the description', async () => {
    const screen = await render(
      <ClassRow explained={explained({ prose: null })} onIntent={vi.fn()} />,
    )

    await expect.element(screen.getByText(/padding-inline: 16px/)).not.toBeVisible()

    await screen.getByText(/details/i).click()

    await expect.element(screen.getByText(/padding-inline: 16px/)).toBeVisible()
  })

  it('stays open across a re-render, so an edit does not collapse it', async () => {
    const screen = await render(<ClassRow explained={explained()} onIntent={vi.fn()} />)

    await screen.getByText(/details/i).click()
    await expect.element(screen.getByRole('button', { name: 'increase px-4' })).toBeVisible()

    await screen.rerender(
      <ClassRow
        explained={explained({
          candidate: { text: 'px-5', range: { start: 0, end: 4 }, index: 0 },
          numericValue: 5,
        })}
        onIntent={vi.fn()}
      />,
    )

    await expect.element(screen.getByRole('button', { name: 'increase px-5' })).toBeVisible()
  })

  it('still offers details in read-only mode, for the raw CSS', async () => {
    const screen = await render(<ClassRow explained={explained({ prose: null })} />)

    await screen.getByText(/details/i).click()

    await expect.element(screen.getByText(/padding-inline: 16px/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'remove px-4' }).elements()).toHaveLength(0)
  })

  it('offers no details section when there is nothing to show', async () => {
    const screen = await render(<ClassRow explained={explained({ declarations: [] })} />)

    expect(screen.getByText(/details/i).elements()).toHaveLength(0)
  })
})
