import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
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
})

const render = (row: ExplainedClass): string => renderToStaticMarkup(<ClassRow explained={row} />)

describe('ClassRow', () => {
  it('says the class sets only internal variables rather than showing an empty block', () => {
    const markup = render(explained('from-blue-500', null, []))
    expect(markup).toContain('sets only Tailwind-internal variables')
    expect(markup).not.toContain('no plain-English entry yet')
    expect(markup).not.toContain('<pre')
  })

  it('styles that copy with the same muted class as the existing note', () => {
    const internalOnly = /class="([^"]*)">sets only Tailwind-internal variables/.exec(
      render(explained('from-blue-500', null, [])),
    )
    const note = /class="([^"]*)">no plain-English entry yet/.exec(
      render(explained('divide-y', null, [{ prop: 'border-top-width', value: '1px' }])),
    )
    expect(internalOnly?.[1]).toBeDefined()
    expect(internalOnly?.[1]).toBe(note?.[1])
  })

  it('still shows the note and the raw CSS when there are declarations', () => {
    const markup = render(explained('divide-y', null, [{ prop: 'border-top-width', value: '1px' }]))
    expect(markup).toContain('no plain-English entry yet')
    expect(markup).toContain('border-top-width: 1px')
    expect(markup).not.toContain('sets only Tailwind-internal variables')
  })

  it('shows prose when there is prose', () => {
    const markup = render(explained('flex', 'lays children out in a row', []))
    expect(markup).toContain('lays children out in a row')
    expect(markup).not.toContain('sets only Tailwind-internal variables')
  })

  it('marks an unknown class rather than claiming it sets internal variables', () => {
    const markup = render(explained('nope-999', null, [], false))
    expect(markup).toContain('not a known Tailwind class')
    expect(markup).not.toContain('sets only Tailwind-internal variables')
  })
})

describe('ClassRow conditional declarations', () => {
  it('shows the condition scoping a declaration rather than presenting it as unconditional', () => {
    const markup = renderToStaticMarkup(
      <ClassRow
        explained={explained('hover-ish', null, [
          { prop: 'display', value: 'flex' },
          { prop: 'background-color', value: 'red', context: '@media (hover: hover)' },
        ])}
      />,
    )

    expect(markup).toContain('@media (hover: hover)')
    expect(markup).toContain('background-color: red')
  })

  it('escapes a condition containing comparison operators rather than emitting raw markup', () => {
    const markup = renderToStaticMarkup(
      <ClassRow
        explained={explained('container', null, [
          { prop: 'max-width', value: '640px', context: '@media (width >= 40rem)' },
        ])}
      />,
    )

    expect(markup).toContain('@media (width &gt;= 40rem)')
    expect(markup).not.toContain('(width >= 40rem)')
  })

  it('does not invent a condition for unconditional declarations', () => {
    const markup = renderToStaticMarkup(
      <ClassRow explained={explained('flex', null, [{ prop: 'display', value: 'flex' }])} />,
    )

    expect(markup).not.toContain('@media')
  })
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

describe('ClassRow swatch qualification', () => {
  it('titles an unconditional swatch with its authored value', () => {
    const markup = renderToStaticMarkup(
      <ClassRow
        explained={withSwatch(
          'bg-red-500',
          [{ prop: 'background-color', value: 'oklch(63% 0.2 25)' }],
          'oklch(63% 0.2 25)',
        )}
      />,
    )

    expect(markup).toContain('title="oklch(63% 0.2 25)"')
    expect(markup).not.toContain('only when')
  })

  it('says when a swatch only applies under a recorded condition', () => {
    const markup = renderToStaticMarkup(
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

    expect(markup).toContain('only when')
    expect(markup).toContain('prefers-color-scheme: dark')
  })

  it('falls back to the variant when the condition lives in the selector, not an at-rule', () => {
    const markup = renderToStaticMarkup(
      <ClassRow
        explained={withSwatch(
          'dark:bg-slate-900',
          [{ prop: 'background-color', value: 'oklch(20% 0.04 265)' }],
          'oklch(20% 0.04 265)',
          ['dark'],
        )}
      />,
    )

    expect(markup).toContain('only when')
    expect(markup).toContain('dark')
  })

  it('marks a conditional swatch with a distinct class and leaves plain ones alone', () => {
    const conditional = renderToStaticMarkup(
      <ClassRow
        explained={withSwatch(
          'dark:bg-slate-900',
          [{ prop: 'background-color', value: 'red' }],
          'red',
          ['dark'],
        )}
      />,
    )
    const plain = renderToStaticMarkup(
      <ClassRow
        explained={withSwatch('bg-red-500', [{ prop: 'background-color', value: 'red' }], 'red')}
      />,
    )

    expect(conditional).toMatch(/class="[^"]*conditional/i)
    expect(plain).not.toMatch(/class="[^"]*conditional/i)
  })
})
