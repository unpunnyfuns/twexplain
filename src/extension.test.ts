import { describe, expect, it, vi } from 'vitest'

vi.mock('vscode', () => ({
  window: {
    registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeTextEditorSelection: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
    activeTextEditor: undefined,
  },
  workspace: {
    onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    createFileSystemWatcher: vi.fn(() => ({
      onDidChange: vi.fn(),
      onDidCreate: vi.fn(),
      onDidDelete: vi.fn(),
      dispose: vi.fn(),
    })),
    getWorkspaceFolder: vi.fn(),
  },
  commands: { registerCommand: vi.fn(() => ({ dispose: vi.fn() })) },
  Uri: { joinPath: vi.fn() },
  Disposable: { from: vi.fn(() => ({ dispose: vi.fn() })) },
}))

describe('activate', () => {
  it('registers the panel without throwing', async () => {
    const { activate } = await import('./extension')
    const context = { subscriptions: [], extensionUri: {} }
    expect(() => activate(context as never)).not.toThrow()
    expect(context.subscriptions).toHaveLength(1)
  })
})
