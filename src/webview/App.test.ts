import { describe, expect, it } from 'vitest'
import { NOTICES } from './App'

describe('panel notices', () => {
  it('gives every notice-only panel state visible copy, so no state renders blank', () => {
    for (const status of [
      'no-selection',
      'no-workspace-tailwind',
      'no-css-entry',
      'unsupported-plugin',
    ]) {
      expect(NOTICES[status]).toBeTruthy()
    }
  })

  it('names @plugin as the unsupported feature rather than leaking an internal error', () => {
    expect(NOTICES['unsupported-plugin']).toBe(
      'This project uses a Tailwind @plugin, which twexplain does not support yet.',
    )
  })
})
