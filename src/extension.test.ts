import { describe, expect, it, vi } from 'vitest'

vi.mock('vscode', () => ({ window: { registerWebviewViewProvider: vi.fn() } }))

describe('activate', () => {
  it('is callable and registers nothing that throws', async () => {
    const { activate } = await import('./extension')
    expect(() => activate({ subscriptions: [] } as never)).not.toThrow()
  })
})
