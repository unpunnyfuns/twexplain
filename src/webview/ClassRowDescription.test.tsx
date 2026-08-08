import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import type { Declaration, ExplainedClass } from '../types'
import { ClassRow } from './ClassRow'

const explained = (
  text: string,
  prose: string | null,
  declarations: Declaration[],
  valid = true,
): ExplainedClass => ({
  candidate: { text, range: { start: 0, end: text.length }, index: 0 },
  valid,
  declarations,
  prose,
  group: 'other',
  variants: [],
  swatch: null,
  numericValue: null,
  modifier: null,
  arbitraryValue: null,
})

const withSwatch = (
  text: string,
  declarations: Declaration[],
  swatch: string,
  variants: string[] = [],
): ExplainedClass => ({
  ...explained(text, 'background red', declarations),
  swatch,
  variants,
})

async function open(row: ExplainedClass) {
  const screen = await render(<ClassRow explained={row} />)
  const toggle = screen.getByRole('button', { name: /details for/i })
  if (toggle.elements().length > 0) await toggle.click()
  return screen
}

describe('description line', () => {
  it('says a class sets only internal variables rather than showing an empty block', async () => {
    const screen = await render(<ClassRow explained={explained('from-blue-500', null, [])} />)

    await expect.element(screen.getByText('sets only Tailwind-internal variables')).toBeVisible()
    expect(screen.getByText('no plain-English entry yet').elements()).toHaveLength(0)
  })

  it('shows the note when there are declarations to fall back on', async () => {
    const screen = await render(
      <ClassRow
        explained={explained('divide-y', null, [{ prop: 'border-top-width', value: '1px' }])}
      />,
    )

    await expect.element(screen.getByText('no plain-English entry yet')).toBeVisible()
    expect(screen.getByText('sets only Tailwind-internal variables').elements()).toHaveLength(0)
  })

  it('shows prose when there is prose', async () => {
    const screen = await render(
      <ClassRow explained={explained('flex', 'lays children out in a row', [])} />,
    )

    await expect.element(screen.getByText('lays children out in a row')).toBeVisible()
  })

  it('marks an unknown class rather than claiming it sets internal variables', async () => {
    const screen = await render(<ClassRow explained={explained('nope-999', null, [], false)} />)

    await expect.element(screen.getByText('not a known Tailwind class')).toBeVisible()
    expect(screen.getByText('sets only Tailwind-internal variables').elements()).toHaveLength(0)
  })
})

describe('conditional declarations', () => {
  it('shows the condition scoping a declaration rather than presenting it as unconditional', async () => {
    const screen = await open(
      explained('hover-ish', null, [
        { prop: 'display', value: 'flex' },
        { prop: 'background-color', value: 'red', context: '@media (hover: hover)' },
      ]),
    )

    await expect.element(screen.getByText(/@media \(hover: hover\)/)).toBeVisible()
    await expect.element(screen.getByText(/background-color: red/)).toBeVisible()
  })

  it('renders a comparison operator as text rather than markup', async () => {
    const screen = await open(
      explained('container', null, [
        { prop: 'max-width', value: '640px', context: '@media (width >= 40rem)' },
      ]),
    )

    await expect.element(screen.getByText(/@media \(width >= 40rem\)/)).toBeVisible()
  })

  it('does not invent a condition for unconditional declarations', async () => {
    const screen = await open(explained('flex', null, [{ prop: 'display', value: 'flex' }]))

    expect(screen.getByText(/@media/).elements()).toHaveLength(0)
  })
})

describe('swatch qualification', () => {
  it('titles an unconditional swatch with its authored value', async () => {
    const screen = await render(
      <ClassRow
        explained={withSwatch(
          'bg-red-500',
          [{ prop: 'background-color', value: 'oklch(63% 0.2 25)' }],
          'oklch(63% 0.2 25)',
        )}
      />,
    )

    await expect.element(screen.getByTitle('oklch(63% 0.2 25)')).toBeVisible()
  })

  it('says when a swatch only applies under a recorded condition', async () => {
    const screen = await render(
      <ClassRow
        explained={withSwatch(
          'dark:bg-slate-900',
          [
            {
              prop: 'background-color',
              value: 'oklch(20% 0.04 265)',
              context: '@media (prefers-color-scheme: dark)',
            },
          ],
          'oklch(20% 0.04 265)',
          ['dark'],
        )}
      />,
    )

    await expect
      .element(screen.getByTitle(/only when @media \(prefers-color-scheme: dark\)/))
      .toBeVisible()
  })

  it('falls back to the variant when the condition lives in the selector', async () => {
    const screen = await render(
      <ClassRow
        explained={withSwatch(
          'dark:bg-slate-900',
          [{ prop: 'background-color', value: 'oklch(20% 0.04 265)' }],
          'oklch(20% 0.04 265)',
          ['dark'],
        )}
      />,
    )

    await expect.element(screen.getByTitle(/only when dark/)).toBeVisible()
  })

  it('does not qualify a swatch that has no condition', async () => {
    const screen = await render(
      <ClassRow
        explained={withSwatch('bg-red-500', [{ prop: 'background-color', value: 'red' }], 'red')}
      />,
    )

    expect(screen.getByTitle(/only when/).elements()).toHaveLength(0)
  })
})

describe('selector scope', () => {
  it('wraps a child-scoped declaration in the selector it actually targets', async () => {
    const screen = await open(
      explained('divide-y', null, [
        {
          prop: 'border-top-width',
          value: '1px',
          selector: ':where(& > :not(:last-child))',
        },
      ]),
    )

    await expect.element(screen.getByText(/:where\(& > :not\(:last-child\)\) \{/)).toBeVisible()
  })

  it('nests the selector inside the at-rule rather than listing them side by side', async () => {
    const screen = await open(
      explained('hover-ish', null, [
        {
          prop: 'background-color',
          value: 'red',
          context: '@media (hover: hover)',
          selector: '&:hover',
        },
      ]),
    )

    const raw = screen.getByText(/@media \(hover: hover\)/)
    await expect.element(raw).toBeVisible()
    expect((await raw.element()).textContent).toBe(
      '@media (hover: hover) {\n  &:hover {\n    background-color: red\n  }\n}',
    )
  })

  it('states a shared scope once rather than repeating it per declaration', async () => {
    const screen = await open(
      explained('divide-y', null, [
        { prop: 'border-top-width', value: '1px', selector: ':where(& > *)' },
        { prop: 'border-bottom-width', value: '0px', selector: ':where(& > *)' },
      ]),
    )

    const raw = screen.getByText(/border-top-width/)
    expect((await raw.element()).textContent).toBe(
      ':where(& > *) {\n  border-top-width: 1px\n  border-bottom-width: 0px\n}',
    )
  })

  it('says a swatch lands on other elements rather than implying it is unconditional', async () => {
    const screen = await render(
      <ClassRow
        explained={{
          ...withSwatch(
            'divide-red-500',
            [
              {
                prop: 'border-color',
                value: 'red',
                selector: ':where(& > :not(:last-child))',
              },
            ],
            'red',
          ),
        }}
      />,
    )

    await expect
      .element(screen.getByTitle('red — only on :where(& > :not(:last-child))'))
      .toBeVisible()
  })

  it('names both when a swatch applies and what it applies to', async () => {
    const screen = await render(
      <ClassRow
        explained={withSwatch(
          'dark:divide-red-500',
          [
            {
              prop: 'border-color',
              value: 'red',
              selector: ':where(&:where(.dark, .dark *) > *)',
            },
          ],
          'red',
          ['dark'],
        )}
      />,
    )

    await expect
      .element(screen.getByTitle('red — only when dark, on :where(&:where(.dark, .dark *) > *)'))
      .toBeVisible()
  })
})
