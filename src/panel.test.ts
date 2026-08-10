import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PanelState } from './types'

type WebviewViewProvider = { resolveWebviewView: (view: unknown) => void }

const captured: { provider?: WebviewViewProvider; commands: Map<string, () => unknown> } = {
  commands: new Map(),
}

vi.mock('vscode', () => ({
  window: {
    registerWebviewViewProvider: vi.fn((_id: string, provider: WebviewViewProvider) => {
      captured.provider = provider
      return { dispose: vi.fn() }
    }),
    onDidChangeTextEditorSelection: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
    activeTextEditor: undefined,
    showTextDocument: vi.fn(async () => undefined),
    showErrorMessage: vi.fn(async () => undefined),
    showInformationMessage: vi.fn(async () => undefined),
  },
  commands: {
    executeCommand: vi.fn(async () => undefined),
    registerCommand: vi.fn((id: string, run: () => unknown) => {
      captured.commands.set(id, run)
      return { dispose: vi.fn() }
    }),
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
    applyEdit: vi.fn(async () => true),
    openTextDocument: vi.fn(async (options: unknown) => ({ options })),
  },
  WorkspaceEdit: class {
    replacements: unknown[] = []
    replace(uri: unknown, range: unknown, newText: string) {
      this.replacements.push({ uri, range, newText })
    }
  },
  Range: class {
    constructor(
      public start: unknown,
      public end: unknown,
    ) {}
  },
  Uri: { joinPath: vi.fn(() => ({})) },
  Disposable: { from: vi.fn(() => ({ dispose: vi.fn() })) },
}))

vi.mock('./state', () => ({ computeState: vi.fn() }))
vi.mock('./intent', () => ({ resolveIntent: vi.fn() }))
vi.mock('./sort', () => ({ resolveSort: vi.fn() }))

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
    fireEdit: (intent: unknown) => readyCb?.({ type: 'edit', intent } as never),
    fireUndo: () => readyCb?.({ type: 'undo' } as never),
    fireDispose: () => disposeCb?.(),
  }
}

function makeFakeEditor(offset: number) {
  return {
    document: {
      getText: () => 'text',
      offsetAt: () => offset,
      positionAt: (n: number) => n,
      uri: { toString: () => 'file:///a.tsx', fsPath: '/a.tsx' },
    },
    selection: { active: offset },
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
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

    const newerState: PanelState = { status: 'ready', groups: [], palette: [], variants: [] }
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

describe('registerPanel loading state', () => {
  it('says it is working when a refresh is slow, rather than leaving stale copy up', async () => {
    vi.useFakeTimers()
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')
    const computeState = vi.mocked(stateModule.computeState)

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, webview, fireReady } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    let resolveSlow: (state: PanelState) => void = () => {}
    computeState.mockImplementationOnce(() => new Promise((r) => (resolveSlow = r)))

    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    fireReady()
    await Promise.resolve()

    expect(webview.postMessage).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)
    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'state',
      state: { status: 'loading' },
    })

    const ready: PanelState = { status: 'ready', groups: [], palette: [], variants: [] }
    resolveSlow(ready)
    await Promise.resolve()
    await Promise.resolve()

    expect(webview.postMessage).toHaveBeenLastCalledWith({ type: 'state', state: ready })
    vi.useRealTimers()
  })

  it('does not flash a loading state when the refresh is fast', async () => {
    vi.useFakeTimers()
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')
    const computeState = vi.mocked(stateModule.computeState)

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, webview, fireReady } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    const ready: PanelState = { status: 'ready', groups: [], palette: [], variants: [] }
    computeState.mockResolvedValueOnce(ready)

    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    fireReady()
    await Promise.resolve()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(1000)

    const posted = webview.postMessage.mock.calls.map((c) => (c[0] as { state: PanelState }).state)
    expect(posted).not.toContainEqual({ status: 'loading' })
    expect(posted).toContainEqual(ready)
    vi.useRealTimers()
  })

  it('does not post a loading state after the view has been disposed', async () => {
    vi.useFakeTimers()
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')
    const computeState = vi.mocked(stateModule.computeState)

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, webview, fireReady, fireDispose } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    computeState.mockImplementationOnce(() => new Promise(() => {}))
    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    fireReady()
    await Promise.resolve()

    fireDispose()
    await vi.advanceTimersByTimeAsync(1000)

    expect(webview.postMessage).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('registerPanel edit intents', () => {
  it('applies a resolved edit as a single workspace edit', async () => {
    const vscode = await import('vscode')
    const intentModule = await import('./intent')
    const { registerPanel } = await import('./panel')
    const resolveIntent = vi.mocked(intentModule.resolveIntent)

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, fireEdit } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    resolveIntent.mockResolvedValue({ start: 16, end: 21, newText: 'gap-3' })

    fireEdit({ type: 'step', index: 1, delta: 1 })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(vi.mocked(vscode.workspace.applyEdit)).toHaveBeenCalledTimes(1)
    const edit = vi.mocked(vscode.workspace.applyEdit).mock.calls[0]?.[0] as unknown as {
      replacements: unknown[]
    }
    expect(edit.replacements).toHaveLength(1)
  })

  it('applies nothing when the intent does not resolve to an edit', async () => {
    const vscode = await import('vscode')
    const intentModule = await import('./intent')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, fireEdit } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(intentModule.resolveIntent).mockResolvedValue(null)

    fireEdit({ type: 'step', index: 0, delta: 1 })
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(vi.mocked(vscode.workspace.applyEdit)).not.toHaveBeenCalled()
  })
})

describe('registerPanel undo', () => {
  it('focuses the editor and runs the editor undo command', async () => {
    const vscode = await import('vscode')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, fireUndo } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    vscode.window.activeTextEditor = makeFakeEditor(1) as never

    fireUndo()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(vi.mocked(vscode.window.showTextDocument)).toHaveBeenCalled()
    expect(vi.mocked(vscode.commands.executeCommand)).toHaveBeenCalledWith('undo')
  })

  it('does nothing without an active editor', async () => {
    const vscode = await import('vscode')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, fireUndo } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    vscode.window.activeTextEditor = undefined
    fireUndo()
    await Promise.resolve()
    await Promise.resolve()

    expect(vi.mocked(vscode.commands.executeCommand)).not.toHaveBeenCalled()
  })
})

describe('registerPanel failure reporting', () => {
  it('tells the user when an edit intent throws instead of failing silently', async () => {
    const vscode = await import('vscode')
    const intentModule = await import('./intent')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, fireEdit } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(intentModule.resolveIntent).mockRejectedValue(new Error('boom'))

    fireEdit({ type: 'step', index: 0, delta: 1 })
    for (let i = 0; i < 6; i++) await Promise.resolve()

    expect(vi.mocked(vscode.window.showErrorMessage)).toHaveBeenCalledWith(
      expect.stringContaining('boom'),
    )
  })

  it('tells the user when a refresh throws', async () => {
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, fireReady } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(stateModule.computeState).mockRejectedValue(new Error('kaboom'))

    fireReady()
    for (let i = 0; i < 6; i++) await Promise.resolve()

    expect(vi.mocked(vscode.window.showErrorMessage)).toHaveBeenCalledWith(
      expect.stringContaining('kaboom'),
    )
  })

  it('does not report anything when nothing throws', async () => {
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, fireReady } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(stateModule.computeState).mockResolvedValue({ status: 'no-selection' })

    fireReady()
    for (let i = 0; i < 6; i++) await Promise.resolve()

    expect(vi.mocked(vscode.window.showErrorMessage)).not.toHaveBeenCalled()
  })
})

describe('registerPanel design-system payload', () => {
  const readyWith = (palette: { name: string; value: string }[]): PanelState => ({
    status: 'ready',
    groups: [],
    palette,
    variants: ['hover'],
  })

  it('sends the palette on the first ready state', async () => {
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, webview, fireReady } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(stateModule.computeState).mockResolvedValue(readyWith([{ name: 'a', value: 'red' }]))

    fireReady()
    for (let i = 0; i < 6; i++) await Promise.resolve()

    const posted = webview.postMessage.mock.calls.map((c) => c[0] as { state?: PanelState })
    const ready = posted.find((m) => m.state?.status === 'ready')
    expect(ready?.state?.status === 'ready' && ready.state.palette).toHaveLength(1)
  })

  it('omits an unchanged palette on later refreshes to keep the message small', async () => {
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, webview, fireReady } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(stateModule.computeState).mockResolvedValue(readyWith([{ name: 'a', value: 'red' }]))

    fireReady()
    for (let i = 0; i < 6; i++) await Promise.resolve()
    webview.postMessage.mockClear()

    fireReady()
    for (let i = 0; i < 6; i++) await Promise.resolve()

    const second = webview.postMessage.mock.calls[0]?.[0] as { state: PanelState }
    expect(second.state.status === 'ready' && second.state.palette).toEqual([])
  })

  it('resends the palette when it actually changes', async () => {
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, webview, fireReady } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(stateModule.computeState).mockResolvedValue(readyWith([{ name: 'a', value: 'red' }]))
    fireReady()
    for (let i = 0; i < 6; i++) await Promise.resolve()

    webview.postMessage.mockClear()
    vi.mocked(stateModule.computeState).mockResolvedValue(readyWith([{ name: 'b', value: 'blue' }]))
    fireReady()
    for (let i = 0; i < 6; i++) await Promise.resolve()

    const second = webview.postMessage.mock.calls[0]?.[0] as { state: PanelState }
    expect(second.state.status === 'ready' && second.state.palette).toHaveLength(1)
  })
})

describe('registerPanel sort command', () => {
  it('registers the sort command', async () => {
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)

    expect(captured.commands.has('twexplain.sortClasses')).toBe(true)
  })

  it('writes the sorted class string back to the document', async () => {
    const vscode = await import('vscode')
    const sortModule = await import('./sort')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(sortModule.resolveSort).mockResolvedValue({
      start: 0,
      end: 4,
      newText: 'flex p-4',
    })

    await captured.commands.get('twexplain.sortClasses')?.()

    expect(vi.mocked(vscode.workspace.applyEdit)).toHaveBeenCalled()
  })

  it('leaves the document alone when the classes are already in order', async () => {
    const vscode = await import('vscode')
    const sortModule = await import('./sort')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(sortModule.resolveSort).mockResolvedValue(null)

    await captured.commands.get('twexplain.sortClasses')?.()

    expect(vi.mocked(vscode.workspace.applyEdit)).not.toHaveBeenCalled()
  })
})

describe('registerPanel curation backlog', () => {
  const unexplained = (text: string) => ({
    status: 'ready' as const,
    palette: [],
    variants: [],
    groups: [
      {
        name: 'other' as const,
        classes: [
          {
            candidate: { text, range: { start: 0, end: text.length }, index: 0 },
            valid: true,
            root: text,
            declarations: [{ prop: 'border-top-width', value: '1px' }],
            prose: null,
            condition: null,
            group: 'other' as const,
            variants: [],
            swatch: null,
            numericValue: null,
            modifier: null,
            arbitraryValue: null,
          },
        ],
      },
    ],
  })

  it('registers the backlog command', async () => {
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)

    expect(captured.commands.has('twexplain.showCurationBacklog')).toBe(true)
  })

  it('opens a report naming the classes the panel could not describe', async () => {
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, fireReady } = makeFakeView()
    captured.provider?.resolveWebviewView(view)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(stateModule.computeState).mockResolvedValue(unexplained('divide-y'))

    fireReady()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await captured.commands.get('twexplain.showCurationBacklog')?.()

    const opened = vi.mocked(vscode.workspace.openTextDocument).mock.calls[0]?.[0] as {
      content: string
      language: string
    }
    expect(opened.language).toBe('markdown')
    expect(opened.content).toContain('divide-y')
    expect(vi.mocked(vscode.window.showTextDocument)).toHaveBeenCalled()
  })

  it('reports an empty backlog rather than doing nothing', async () => {
    const vscode = await import('vscode')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)

    await captured.commands.get('twexplain.showCurationBacklog')?.()

    const opened = vi.mocked(vscode.workspace.openTextDocument).mock.calls[0]?.[0] as {
      content: string
    }
    expect(opened.content).toContain('Nothing to curate')
  })
})

describe('registerPanel webview document', () => {
  async function htmlFor(): Promise<string> {
    const { registerPanel } = await import('./panel')
    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view } = makeFakeView()
    captured.provider?.resolveWebviewView(view)
    return view.webview.html
  }

  it('allows the codicon font, which the panel icons need', async () => {
    expect(await htmlFor()).toContain('font-src csp-source')
  })

  it('still forbids everything not explicitly allowed', async () => {
    expect(await htmlFor()).toContain("default-src 'none'")
  })

  it('links the codicon stylesheet alongside the panel stylesheet', async () => {
    const html = await htmlFor()
    const sheets = html.match(/rel="stylesheet"/g) ?? []

    expect(sheets).toHaveLength(2)
  })
})
