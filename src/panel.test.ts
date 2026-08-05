import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PanelState } from './types'

type WebviewViewProvider = { resolveWebviewView: (view: unknown) => void }

const captured: { provider?: WebviewViewProvider } = {}

vi.mock('vscode', () => ({
  window: {
    registerWebviewViewProvider: vi.fn((_id: string, provider: WebviewViewProvider) => {
      captured.provider = provider
      return { dispose: vi.fn() }
    }),
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
    getWorkspaceFolder: vi.fn(() => ({ uri: { fsPath: '/workspace' } })),
  },
  Uri: { joinPath: vi.fn(() => ({})) },
  Disposable: { from: vi.fn(() => ({ dispose: vi.fn() })) },
}))

vi.mock('./state', () => ({ computeState: vi.fn() }))

function makeFakeView() {
  let disposeCb: (() => void) | undefined
  let readyCb: ((message: { type: string }) => void) | undefined
  const webview = {
    options: undefined as unknown,
    html: '',
    cspSource: 'csp-source',
    postMessage: vi.fn(),
    asWebviewUri: vi.fn(() => 'uri://x'),
    onDidReceiveMessage: vi.fn((cb: (message: { type: string }) => void) => {
      readyCb = cb
      return { dispose: vi.fn() }
    }),
  }
  const view = {
    webview,
    onDidDispose: vi.fn((cb: () => void) => {
      disposeCb = cb
      return { dispose: vi.fn() }
    }),
  }
  return {
    view,
    webview,
    fireReady: () => readyCb?.({ type: 'ready' }),
    fireDispose: () => disposeCb?.(),
  }
}

function makeFakeEditor(offset: number) {
  return {
    document: {
      getText: () => 'text',
      offsetAt: () => offset,
      uri: { toString: () => 'file:///a.tsx', fsPath: '/a.tsx' },
    },
    selection: { active: offset },
  }
}

beforeEach(() => {
  vi.resetModules()
  captured.provider = undefined
})

describe('registerPanel disposal guard', () => {
  it('stops posting once the webview view has been disposed', async () => {
    const { registerPanel } = await import('./panel')
    const context = { subscriptions: [], extensionUri: {} }
    registerPanel(context as never)

    const { view, webview, fireReady, fireDispose } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    fireDispose()
    fireReady()
    await Promise.resolve()
    await Promise.resolve()

    expect(webview.postMessage).not.toHaveBeenCalled()
  })
})

describe('registerPanel generation guard', () => {
  it('only posts the result of the newest refresh when refreshes overlap', async () => {
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')
    const computeState = vi.mocked(stateModule.computeState)

    const context = { subscriptions: [], extensionUri: {} }
    registerPanel(context as never)

    const { view, webview, fireReady } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    let resolveOlder: (state: PanelState) => void = () => {}
    let resolveNewer: (state: PanelState) => void = () => {}
    computeState
      .mockImplementationOnce(() => new Promise((resolve) => (resolveOlder = resolve)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveNewer = resolve)))

    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    fireReady()
    await Promise.resolve()

    vscode.window.activeTextEditor = makeFakeEditor(2) as never
    fireReady()
    await Promise.resolve()

    const newerState: PanelState = { status: 'ready', groups: [] }
    const olderState: PanelState = { status: 'no-selection' }

    resolveNewer(newerState)
    await Promise.resolve()
    await Promise.resolve()

    resolveOlder(olderState)
    await Promise.resolve()
    await Promise.resolve()

    expect(webview.postMessage).toHaveBeenCalledTimes(1)
    expect(webview.postMessage).toHaveBeenCalledWith({ type: 'state', state: newerState })
  })
})
