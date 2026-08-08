// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExplainedClass } from '../types'
import { ClassRow } from './ClassRow'

afterEach(cleanup)

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
  it('asks to increase the value, carrying the candidate index', () => {
    const onIntent = vi.fn()
    render(<ClassRow explained={explained()} onIntent={onIntent} />)

    fireEvent.click(screen.getByRole('button', { name: /increase px-4/i }))

    expect(onIntent).toHaveBeenCalledWith({ type: 'step', index: 3, delta: 1 })
  })

  it('asks to decrease the value', () => {
    const onIntent = vi.fn()
    render(<ClassRow explained={explained()} onIntent={onIntent} />)

    fireEvent.click(screen.getByRole('button', { name: /decrease px-4/i }))

    expect(onIntent).toHaveBeenCalledWith({ type: 'step', index: 3, delta: -1 })
  })

  it('is absent for a class with no numeric value', () => {
    render(<ClassRow explained={explained({ numericValue: null })} onIntent={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /increase/i })).toBeNull()
  })

  it('cannot decrease below zero', () => {
    render(
      <ClassRow
        explained={explained({
          numericValue: 0,
          candidate: { text: 'px-0', range: { start: 0, end: 4 }, index: 1 },
        })}
        onIntent={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /decrease px-0/i }).hasAttribute('disabled')).toBe(
      true,
    )
  })
})

describe('remove control', () => {
  it('asks to remove the class', () => {
    const onIntent = vi.fn()
    render(<ClassRow explained={explained()} onIntent={onIntent} />)

    fireEvent.click(screen.getByRole('button', { name: /remove px-4/i }))

    expect(onIntent).toHaveBeenCalledWith({ type: 'remove', index: 3 })
  })

  it('is offered even for a class Tailwind does not recognise', () => {
    const onIntent = vi.fn()
    render(
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

    fireEvent.click(screen.getByRole('button', { name: /remove nope-999/i }))

    expect(onIntent).toHaveBeenCalledWith({ type: 'remove', index: 0 })
  })
})

describe('read-only rendering', () => {
  it('renders no controls when no intent handler is supplied', () => {
    render(<ClassRow explained={explained()} />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText(/padding of 16px/)).toBeTruthy()
  })
})
