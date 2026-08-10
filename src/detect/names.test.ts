import { describe, expect, it } from 'vitest'
import { attributesFrom, DEFAULT_ATTRIBUTES, DEFAULT_FUNCTIONS, functionsFrom } from './names'

describe('with nothing configured, which is the case without IntelliSense', () => {
  it('still reads the attributes people actually use', () => {
    expect(attributesFrom(undefined)).toEqual(DEFAULT_ATTRIBUTES)
    expect(attributesFrom(undefined)).toContain('class')
    expect(attributesFrom(undefined)).toContain('className')
  })

  it('matches the attribute list IntelliSense defaults to', () => {
    expect(DEFAULT_ATTRIBUTES).toEqual(['class', 'className', 'ngClass', 'class:list'])
  })

  it('still reads the helper calls people actually use', () => {
    expect(functionsFrom(undefined)).toEqual(DEFAULT_FUNCTIONS)
    expect(functionsFrom(undefined)).toContain('cva')
    expect(functionsFrom(undefined)).toContain('twMerge')
  })

  it('treats an empty configured list as nothing to add, not as a replacement', () => {
    expect(attributesFrom({ attributes: [] })).toEqual(DEFAULT_ATTRIBUTES)
    expect(functionsFrom({ functions: [] })).toEqual(DEFAULT_FUNCTIONS)
  })
})

describe('with names configured', () => {
  it('adds them without losing the defaults', () => {
    const attributes = attributesFrom({ attributes: ['wrapperClassName'] })

    expect(attributes).toContain('wrapperClassName')
    expect(attributes).toContain('className')
  })

  it('does not duplicate a name that is already a default', () => {
    const attributes = attributesFrom({ attributes: ['class'] })

    expect(attributes.filter((name) => name === 'class')).toHaveLength(1)
  })
})
