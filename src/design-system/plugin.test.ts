import { describe, expect, it } from 'vitest'
import { hasPluginDirective } from './load'

describe('hasPluginDirective', () => {
  it('detects a real plugin directive', () => {
    expect(hasPluginDirective('@import "tailwindcss";\n@plugin "@tailwindcss/typography";')).toBe(
      true,
    )
  })

  it('ignores a directive mentioned inside a block comment', () => {
    expect(
      hasPluginDirective('/* we could add @plugin "x" here later */\n.a { color: red; }'),
    ).toBe(false)
  })

  it('ignores a directive mentioned inside a line comment', () => {
    expect(hasPluginDirective('// @plugin "x" is not supported yet\n.a { color: red; }')).toBe(
      false,
    )
  })

  it('still detects a directive that follows a comment mentioning it', () => {
    expect(hasPluginDirective('/* @plugin "x" */\n@plugin "@tailwindcss/typography";')).toBe(true)
  })

  it('is not fooled by a comment that never closes', () => {
    expect(hasPluginDirective('/* @plugin "x"')).toBe(false)
  })

  it('reports false for css with no directive at all', () => {
    expect(hasPluginDirective('@import "tailwindcss";\n.a { color: red; }')).toBe(false)
  })
})
