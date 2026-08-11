import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isSupportedVersion, readTailwindVersion } from './version'

const fixture = (name: string): string => join(__dirname, '__fixtures__', name)

describe('readTailwindVersion', () => {
  const tailwind = (name: string): string => join(fixture(name), 'node_modules', 'tailwindcss')

  it('reads the version from the package it is given', async () => {
    expect(await readTailwindVersion(tailwind('standard'))).toBe('4.1.7')
  })

  it('returns null when there is no package there', async () => {
    expect(await readTailwindVersion(tailwind('none'))).toBeNull()
  })
})

describe('isSupportedVersion', () => {
  it('accepts v4', () => {
    expect(isSupportedVersion('4.1.7')).toBe(true)
    expect(isSupportedVersion('4.0.0')).toBe(true)
  })

  it('rejects v3', () => {
    expect(isSupportedVersion('3.4.17')).toBe(false)
  })
})
