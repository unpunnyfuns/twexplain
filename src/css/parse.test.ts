import { describe, expect, it } from 'vitest'
import { parseCss } from './parse'

describe('parseCss', () => {
  it('parses flat declarations', () => {
    expect(parseCss('.flex {\n  display: flex;\n}')).toEqual([
      {
        type: 'rule',
        selector: '.flex',
        children: [{ type: 'decl', prop: 'display', value: 'flex' }],
      },
    ])
  })

  it('parses nested rules', () => {
    const css = '.a {\n  &:hover {\n    @media (hover: hover) {\n      color: red;\n    }\n  }\n}'
    expect(parseCss(css)).toEqual([
      {
        type: 'rule',
        selector: '.a',
        children: [
          {
            type: 'rule',
            selector: '&:hover',
            children: [
              {
                type: 'rule',
                selector: '@media (hover: hover)',
                children: [{ type: 'decl', prop: 'color', value: 'red' }],
              },
            ],
          },
        ],
      },
    ])
  })

  it('does not split on semicolons or braces inside parentheses', () => {
    const css = '.a { clip: rect(0, 0, 0, 0); padding: calc(var(--x) * 4); }'
    expect(parseCss(css)[0]).toMatchObject({
      children: [
        { prop: 'clip', value: 'rect(0, 0, 0, 0)' },
        { prop: 'padding', value: 'calc(var(--x) * 4)' },
      ],
    })
  })

  it('parses @property blocks as rules', () => {
    const css = '@property --tw-shadow {\n  syntax: "*";\n  inherits: false;\n}'
    expect(parseCss(css)[0]).toMatchObject({ type: 'rule', selector: '@property --tw-shadow' })
  })
})
