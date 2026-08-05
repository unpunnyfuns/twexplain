import { describe, expect, it } from 'vitest'
import { parseCss } from '../css/parse'
import { strip } from './strip'

describe('strip', () => {
  it('removes @property blocks', () => {
    const css = '.a { color: red; }\n@property --tw-shadow { syntax: "*"; }'
    expect(strip(parseCss(css))).toHaveLength(1)
  })

  it('removes --tw-* declarations but keeps others', () => {
    const css = '.a { --tw-shadow: 0 1px 2px black; box-shadow: var(--tw-shadow); }'
    expect(strip(parseCss(css))[0]).toMatchObject({
      children: [{ prop: 'box-shadow', value: 'var(--tw-shadow)' }],
    })
  })

  it('drops rules left empty after stripping', () => {
    const css = '.a { --tw-only: 1; }'
    expect(strip(parseCss(css))).toEqual([])
  })

  it('strips recursively through nested rules', () => {
    const css = '.a { &:hover { --tw-x: 1; color: red; } }'
    expect(strip(parseCss(css))[0]).toMatchObject({
      children: [{ selector: '&:hover', children: [{ prop: 'color', value: 'red' }] }],
    })
  })
})
