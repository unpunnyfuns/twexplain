import { describe, expect, it } from 'vitest'
import { detectClassString } from './index'
import { looksLikeClassList } from './shared'

const find = (text: string, needle: string, languageId = 'svelte') =>
  detectClassString({
    text,
    offset: text.indexOf(needle) + 1,
    uri: 'file:///a.svelte',
    languageId,
  })

describe('a Svelte class attribute holding an inline expression', () => {
  const markup = `<div class="rounded p-4 {isOn ? 'bg-red-500' : 'bg-white'} shadow">x</div>`

  it('reads the static classes around the expression', () => {
    expect(find(markup, 'rounded')?.candidates.map((c) => c.text)).toEqual([
      'rounded',
      'p-4',
      'shadow',
    ])
  })

  it('never offers a fragment of the expression as a class', () => {
    const texts = find(markup, 'rounded')?.candidates.map((c) => c.text) ?? []

    for (const text of texts) {
      expect(text).not.toContain('{')
      expect(text).not.toContain('?')
      expect(text).not.toContain("'")
    }
  })

  it('keeps the offsets of the classes it does report', () => {
    for (const candidate of find(markup, 'rounded')?.candidates ?? []) {
      expect(markup.slice(candidate.range.start, candidate.range.end)).toBe(candidate.text)
    }
  })

  it('explains nothing when the cursor is inside the expression', () => {
    expect(find(markup, 'isOn')).toBeNull()
  })

  it('handles an expression containing braces of its own', () => {
    const nested = `<div class="flex {cond ? {a: 1} : 2} gap-2">x</div>`

    expect(find(nested, 'flex')?.candidates.map((c) => c.text)).toEqual(['flex', 'gap-2'])
  })

  it('handles several expressions in one attribute', () => {
    const many = `<div class="a {x} b {y} c">t</div>`

    expect(find(many, '"a')?.candidates.map((c) => c.text)).toEqual(['a', 'b', 'c'])
  })

  it('still reads a plain attribute untouched', () => {
    const plain = '<div class="flex gap-2">x</div>'

    expect(find(plain, 'flex')?.candidates.map((c) => c.text)).toEqual(['flex', 'gap-2'])
  })
})

describe('the class-list guard', () => {
  it('accepts an arbitrary value containing a less-than sign', () => {
    expect(looksLikeClassList("before:content-['<'] flex")).toBe(true)
  })

  it('still refuses a value that has swallowed a tag', () => {
    expect(looksLikeClassList('flex <span>x</span>')).toBe(false)
    expect(looksLikeClassList('foo>\n<div class=')).toBe(false)
  })
})
