import { describe, expect, it } from 'vitest'
import { detectJsx } from './jsx'

const source = '<div className="flex items-center gap-2">x</div>'

describe('detectJsx', () => {
  it('returns null when the cursor is outside a class string', () => {
    expect(detectJsx(source, 2, 'file:///a.tsx')).toBeNull()
  })

  it('finds the class string containing the cursor', () => {
    const found = detectJsx(source, 20, 'file:///a.tsx')
    expect(found?.kind).toBe('jsx')
    expect(found?.candidates.map((c) => c.text)).toEqual([
      'flex',
      'items-center',
      'gap-2',
    ])
  })

  it('reports absolute document offsets for each candidate', () => {
    const found = detectJsx(source, 20, 'file:///a.tsx')
    const first = found?.candidates[0]
    expect(source.slice(first?.range.start, first?.range.end)).toBe('flex')
    const last = found?.candidates[2]
    expect(source.slice(last?.range.start, last?.range.end)).toBe('gap-2')
  })

  it('handles the plain class attribute', () => {
    const html = '<div class="p-4">x</div>'
    expect(detectJsx(html, 13, 'file:///a.tsx')?.candidates.map((c) => c.text)).toEqual(['p-4'])
  })

  it('handles single quotes', () => {
    const single = "<div className='p-4 m-2'>x</div>"
    expect(detectJsx(single, 18, 'file:///a.tsx')?.candidates).toHaveLength(2)
  })

  it('collapses runs of whitespace without emitting empty candidates', () => {
    const messy = '<div className="flex   gap-2">x</div>'
    expect(detectJsx(messy, 20, 'file:///a.tsx')?.candidates.map((c) => c.text)).toEqual([
      'flex',
      'gap-2',
    ])
  })

  it('finds the correct string when several are present', () => {
    const two = '<a className="p-1"/><b className="m-2"/>'
    expect(detectJsx(two, 35, 'file:///a.tsx')?.candidates[0]?.text).toBe('m-2')
  })

  it('cursor exactly at valueStart (opening quote boundary)', () => {
    const valueStart = source.indexOf('flex')
    const found = detectJsx(source, valueStart, 'file:///a.tsx')
    expect(found).not.toBeNull()
    expect(found?.candidates.map((c) => c.text)).toEqual([
      'flex',
      'items-center',
      'gap-2',
    ])
  })

  it('cursor exactly at valueEnd (closing quote boundary)', () => {
    const valueEnd = source.indexOf('gap-2') + 'gap-2'.length
    const found = detectJsx(source, valueEnd, 'file:///a.tsx')
    expect(found).not.toBeNull()
  })

  it('cursor at valueEnd + 1 returns null (after closing quote)', () => {
    const valueEnd = source.indexOf('gap-2') + 'gap-2'.length
    expect(detectJsx(source, valueEnd + 1, 'file:///a.tsx')).toBeNull()
  })

  it('cursor one before valueStart returns null (on opening quote)', () => {
    const valueStart = source.indexOf('flex')
    expect(detectJsx(source, valueStart - 1, 'file:///a.tsx')).toBeNull()
  })

  it('empty class string returns non-null with empty candidates array', () => {
    const empty = '<div className="">x</div>'
    const found = detectJsx(empty, empty.indexOf('""') + 1, 'file:///a.tsx')
    expect(found).not.toBeNull()
    expect(found?.candidates).toEqual([])
  })

  it('offset recovery for all candidates', () => {
    const found = detectJsx(source, 20, 'file:///a.tsx')
    expect(found).not.toBeNull()
    found?.candidates.forEach((c) => {
      expect(source.slice(c.range.start, c.range.end)).toBe(c.text)
    })
  })
})

const MULTILINE = `<div
  className="flex items-center
    gap-2 px-4"
>x</div>`

describe('detectJsx across newlines', () => {
  it('detects a class string that the author wrapped over several lines', () => {
    const offset = MULTILINE.indexOf('items-center')
    const found = detectJsx(MULTILINE, offset, 'file:///a.tsx')

    expect(found?.candidates.map((c) => c.text)).toEqual([
      'flex',
      'items-center',
      'gap-2',
      'px-4',
    ])
  })

  it('works with the cursor on a continuation line', () => {
    const offset = MULTILINE.indexOf('px-4')
    expect(detectJsx(MULTILINE, offset, 'file:///a.tsx')).not.toBeNull()
  })

  it('reports offsets that still recover each candidate across the newline', () => {
    const found = detectJsx(MULTILINE, MULTILINE.indexOf('flex'), 'file:///a.tsx')
    for (const c of found?.candidates ?? []) {
      expect(MULTILINE.slice(c.range.start, c.range.end)).toBe(c.text)
    }
  })

  it('does not swallow a distant quote when a class string is left unterminated', () => {
    const unterminated = ['<div className="flex', ...Array(30).fill('  const x = 1'), 'const s = "later"'].join(
      '\n',
    )
    const offset = unterminated.indexOf('flex')

    const found = detectJsx(unterminated, offset, 'file:///a.tsx')
    expect(found?.candidates.map((c) => c.text) ?? []).not.toContain('const')
  })
})
