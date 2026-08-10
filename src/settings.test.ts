import { beforeEach, describe, expect, it, vi } from 'vitest'

const values = new Map<string, unknown>()

vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn((section: string) => ({
      get: (key: string) => values.get(`${section}.${key}`),
    })),
  },
}))

beforeEach(() => {
  values.clear()
  vi.resetModules()
})

describe('settings follow Tailwind CSS IntelliSense', () => {
  it('reads the root font size the user configured for IntelliSense', async () => {
    values.set('tailwindCSS.rootFontSize', 10)
    const { readSettings } = await import('./settings')

    expect(readSettings().rootFontSize).toBe(10)
  })

  it('falls back to the browser default when nothing is configured', async () => {
    const { readSettings } = await import('./settings')

    expect(readSettings().rootFontSize).toBe(16)
  })

  it('honours turning pixel equivalents off', async () => {
    values.set('tailwindCSS.showPixelEquivalents', false)
    const { readSettings } = await import('./settings')

    expect(readSettings().pixelEquivalents).toBe(false)
  })

  it('shows pixel equivalents by default, as IntelliSense does', async () => {
    const { readSettings } = await import('./settings')

    expect(readSettings().pixelEquivalents).toBe(true)
  })

  it('picks up extra class attributes', async () => {
    values.set('tailwindCSS.classAttributes', ['class', 'wrapperClassName'])
    const { readSettings } = await import('./settings')

    expect(readSettings().classAttributes).toContain('wrapperClassName')
  })

  it('picks up extra class functions', async () => {
    values.set('tailwindCSS.classFunctions', ['cls'])
    const { readSettings } = await import('./settings')

    expect(readSettings().classFunctions).toEqual(['cls'])
  })

  it('reads nothing of its own, so there is one place to configure this', async () => {
    const vscode = await import('vscode')
    const { readSettings } = await import('./settings')

    readSettings()

    const sections = vi.mocked(vscode.workspace.getConfiguration).mock.calls.map(([s]) => s)
    expect([...new Set(sections)]).toEqual(['tailwindCSS'])
  })
})
