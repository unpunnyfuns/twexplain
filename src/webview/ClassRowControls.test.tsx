import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import type { ExplainedClass } from '../types'
import { ClassRow } from './ClassRow'

const explained = (overrides: Partial<ExplainedClass> = {}): ExplainedClass => ({
  candidate: { text: 'px-4', range: { start: 0, end: 4 }, index: 3 },
  valid: true,
  declarations: [{ prop: 'padding-inline', value: '16px' }],
  prose: 'padding of 16px on the left and right',
  group: 'spacing',
  variants: [],
  swatch: null,
  numericValue: 4,
  ...overrides,
})

describe('stepper', () => {
  it('asks to increase the value, carrying the candidate index', async () => {
    const onIntent = vi.fn()
    const screen = await render(<ClassRow explained={explained()} onIntent={onIntent} />)

    await screen.getByRole('button', { name: 'increase px-4' }).click()

    expect(onIntent).toHaveBeenCalledWith({ type: 'step', index: 3, delta: 1 })
  })

  it('asks to decrease the value', async () => {
    const onIntent = vi.fn()
    const screen = await render(<ClassRow explained={explained()} onIntent={onIntent} />)

    await screen.getByRole('button', { name: 'decrease px-4' }).click()

    expect(onIntent).toHaveBeenCalledWith({ type: 'step', index: 3, delta: -1 })
  })

  it('is absent for a class with no numeric value', async () => {
    const screen = await render(
      <ClassRow explained={explained({ numericValue: null })} onIntent={vi.fn()} />,
    )

    await expect.element(screen.getByRole('button', { name: 'remove px-4' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'increase px-4' }).elements()).toHaveLength(0)
  })

  it('cannot decrease below zero', async () => {
    const screen = await render(
      <ClassRow
        explained={explained({
          numericValue: 0,
          candidate: { text: 'px-0', range: { start: 0, end: 4 }, index: 1 },
        })}
        onIntent={vi.fn()}
      />,
    )

    await expect.element(screen.getByRole('button', { name: 'decrease px-0' })).toBeDisabled()
  })
})

describe('remove control', () => {
  it('asks to remove the class', async () => {
    const onIntent = vi.fn()
    const screen = await render(<ClassRow explained={explained()} onIntent={onIntent} />)

    await screen.getByRole('button', { name: 'remove px-4' }).click()

    expect(onIntent).toHaveBeenCalledWith({ type: 'remove', index: 3 })
  })

  it('is offered even for a class Tailwind does not recognise', async () => {
    const onIntent = vi.fn()
    const screen = await render(
      <ClassRow
        explained={explained({
          valid: false,
          prose: null,
          declarations: [],
          numericValue: null,
          candidate: { text: 'nope-999', range: { start: 0, end: 8 }, index: 0 },
        })}
        onIntent={onIntent}
      />,
    )

    await screen.getByRole('button', { name: 'remove nope-999' }).click()

    expect(onIntent).toHaveBeenCalledWith({ type: 'remove', index: 0 })
  })
})

describe('read-only rendering', () => {
  it('renders no controls when no intent handler is supplied', async () => {
    const screen = await render(<ClassRow explained={explained()} />)

    await expect.element(screen.getByText(/padding of 16px/)).toBeVisible()
    expect(screen.getByRole('button').elements()).toHaveLength(0)
  })
})

describe('variant chips in a row', () => {
  it('offers variant toggles when editing is enabled', async () => {
    const onIntent = vi.fn()
    const screen = await render(<ClassRow explained={explained()} onIntent={onIntent} />)

    await screen.getByRole('button', { name: 'hover', exact: true }).click()

    expect(onIntent).toHaveBeenCalledWith({ type: 'addVariant', index: 3, variant: 'hover' })
  })

  it('shows the row variants as pressed', async () => {
    const screen = await render(
      <ClassRow
        explained={explained({
          variants: ['md'],
          candidate: { text: 'md:px-4', range: { start: 0, end: 7 }, index: 3 },
        })}
        onIntent={vi.fn()}
      />,
    )

    await expect
      .element(screen.getByRole('button', { name: 'md', exact: true }))
      .toHaveAttribute('aria-pressed', 'true')
  })

  it('offers no variant toggles in read-only mode', async () => {
    const screen = await render(<ClassRow explained={explained()} />)

    expect(screen.getByRole('button', { name: 'hover', exact: true }).elements()).toHaveLength(0)
  })
})
