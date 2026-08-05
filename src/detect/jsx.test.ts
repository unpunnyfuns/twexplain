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
})
