import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PanelState } from './types'

type WebviewViewProvider = { resolveWebviewView: (view: unknown) => void }

const captured: {
  provider?: WebviewViewProvider
  commands: Map<string, () => unknown>
  listeners: Map<string, (arg?: unknown) => void>
  watcher: Map<string, () => void>
} = {
  commands: new Map(),
  listeners: new Map(),
  watcher: new Map(),
}

function remember(name: string) {
  return vi.fn((cb: (arg?: unknown) => void) => {
    captured.listeners.set(name, cb)
    return { dispose: vi.fn() }
  })
}

vi.mock('vscode', () => ({
  window: {
    registerWebviewViewProvider: vi.fn((_id: string, provider: WebviewViewProvider) => {
      captured.provider = provider
      return { dispose: vi.fn() }
    }),
    onDidChangeTextEditorSelection: remember('selection'),
    onDidChangeActiveTextEditor: remember('activeEditor'),
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
    onDidChangeTextDocument: remember('document'),
    createFileSystemWatcher: vi.fn(() => ({
      onDidChange: vi.fn((cb: () => void) => captured.watcher.set('change', cb)),
      onDidCreate: vi.fn((cb: () => void) => captured.watcher.set('create', cb)),
      onDidDelete: vi.fn((cb: () => void) => captured.watcher.set('delete', cb)),
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
vi.mock('./search', () => ({ searchClasses: vi.fn(async () => ['gap-2']) }))
vi.mock('./design-system/load', () => ({ clearDesignSystemCache: vi.fn() }))

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
  let visibilityCb: (() => void) | undefined
  const view = {
    webview,
    visible: true,
    onDidChangeVisibility: vi.fn((cb: () => void) => {
      visibilityCb = cb
      return { dispose: vi.fn() }
    }),
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
    fireSearch: (query: string) => readyCb?.({ type: 'search', query } as never),
    fireDispose: () => disposeCb?.(),
    setVisible: (next: boolean) => {
      view.visible = next
      visibilityCb?.()
    },
  }
}

function makeFakeEditor(offset: number, version = 1) {
  return {
    document: {
      getText: () => 'text',
      offsetAt: () => offset,
      positionAt: (n: number) => n,
      version,
      uri: { toString: () => 'file:///a.tsx', fsPath: '/a.tsx' },
    },
    selection: { active: offset },
  }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  captured.provider = undefined
  captured.listeners.clear()
  captured.watcher.clear()
})

describe('registerPanel disposal guard', () => {
  it('stops posting once the webview view has been disposed', async () => {
    const { registerPanel } = await import('./panel')
    const context = { subscriptions: [], extensionUri: {} }
    registerPanel(context as never)

    const { view, webview, fireReady, fireDispose } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    const stateModule = await import('./state')
    fireDispose()
    fireReady()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(webview.postMessage).not.toHaveBeenCalled()
    expect(vi.mocked(stateModule.computeState)).not.toHaveBeenCalled()
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
    await new Promise((resolve) => setTimeout(resolve, 0))

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

describe('edits are refused when the document has moved underneath them', () => {
  it('writes the resolved text at the resolved offsets', async () => {
    const vscode = await import('vscode')
    const intentModule = await import('./intent')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, fireEdit } = makeFakeView()
    captured.provider?.resolveWebviewView(view)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(intentModule.resolveIntent).mockResolvedValue({ start: 3, end: 7, newText: 'px-5' })

    fireEdit({ type: 'step', index: 0, delta: 1 })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const edit = vi.mocked(vscode.workspace.applyEdit).mock.calls[0]?.[0] as unknown as {
      replacements: { range: { start: unknown; end: unknown }; newText: string }[]
    }
    expect(edit.replacements[0]?.newText).toBe('px-5')
    expect(edit.replacements[0]?.range).toEqual({ start: 3, end: 7 })
  })

  it('does not write when the document changed while the edit was being resolved', async () => {
    const vscode = await import('vscode')
    const intentModule = await import('./intent')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, fireEdit } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    const editor = makeFakeEditor(1)
    vscode.window.activeTextEditor = editor as never
    vi.mocked(intentModule.resolveIntent).mockImplementation(async () => {
      editor.document.version = 2
      return { start: 0, end: 4, newText: 'flex' }
    })

    fireEdit({ type: 'step', index: 0, delta: 1 })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(vi.mocked(vscode.workspace.applyEdit)).not.toHaveBeenCalled()
  })

  it('runs two edits one after the other rather than from the same snapshot', async () => {
    const vscode = await import('vscode')
    const intentModule = await import('./intent')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, fireEdit } = makeFakeView()
    captured.provider?.resolveWebviewView(view)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never

    let running = 0
    let overlapped = false
    vi.mocked(intentModule.resolveIntent).mockImplementation(async () => {
      running++
      if (running > 1) overlapped = true
      await new Promise((resolve) => setTimeout(resolve, 5))
      running--
      return { start: 0, end: 4, newText: 'flex' }
    })

    fireEdit({ type: 'step', index: 0, delta: 1 })
    fireEdit({ type: 'step', index: 0, delta: 1 })
    await new Promise((resolve) => setTimeout(resolve, 40))

    expect(overlapped).toBe(false)
  })
})

describe('the panel refreshes as the cursor moves', () => {
  async function ready() {
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, webview } = makeFakeView()
    captured.provider?.resolveWebviewView(view)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(stateModule.computeState).mockResolvedValue({ status: 'no-selection' })
    return { webview }
  }

  it.each(['selection', 'activeEditor', 'document'])(
    'explains the class string again after a %s change',
    async (event) => {
      const { webview } = await ready()

      captured.listeners.get(event)?.()
      await new Promise((resolve) => setTimeout(resolve, 250))

      expect(webview.postMessage).toHaveBeenCalled()
    },
  )

  it('waits rather than recomputing on every keystroke', async () => {
    const stateModule = await import('./state')
    await ready()

    captured.listeners.get('selection')?.()
    captured.listeners.get('selection')?.()
    captured.listeners.get('selection')?.()
    await new Promise((resolve) => setTimeout(resolve, 250))

    expect(vi.mocked(stateModule.computeState).mock.calls.length).toBe(1)
  })
})

describe('the search half of the protocol', () => {
  it('answers a search with suggestions for that query', async () => {
    const vscode = await import('vscode')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, webview, fireSearch } = makeFakeView()
    captured.provider?.resolveWebviewView(view)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never

    fireSearch('gap')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(webview.postMessage).toHaveBeenCalledWith({
      type: 'suggestions',
      query: 'gap',
      matches: ['gap-2'],
    })
  })
})

describe('a stylesheet change invalidates the design system', () => {
  it.each(['change', 'create', 'delete'])('clears the cache on %s', async (event) => {
    const load = await import('./design-system/load')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    captured.watcher.get(event)?.()

    expect(vi.mocked(load.clearDesignSystemCache)).toHaveBeenCalled()
  })
})

describe('the webview document is loadable', () => {
  it('gives the script the very nonce the policy allows', async () => {
    const { registerPanel } = await import('./panel')
    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    const html = view.webview.html
    const allowed = /script-src 'nonce-([A-Za-z0-9]+)'/.exec(html)?.[1]
    const used = /<script nonce="([A-Za-z0-9]+)"/.exec(html)?.[1]

    expect(allowed).toBeDefined()
    expect(used).toBe(allowed)
  })
})

describe('the panel resends a payload whose contents changed', () => {
  async function post(state: unknown) {
    const stateModule = await import('./state')
    vi.mocked(stateModule.computeState).mockResolvedValue(state as never)
    captured.listeners.get('selection')?.()
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  const ready = (palette: { name: string; value: string }[], variants: string[]) => ({
    status: 'ready' as const,
    groups: [],
    palette,
    variants,
  })

  it('resends when the variant list changes but the palette does not', async () => {
    const vscode = await import('vscode')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, webview } = makeFakeView()
    captured.provider?.resolveWebviewView(view)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never

    await post(ready([{ name: 'blue', value: '#00f' }], ['hover']))
    await post(ready([{ name: 'blue', value: '#00f' }], ['focus']))

    const sent = webview.postMessage.mock.calls.at(-1)?.[0] as { state: { variants: string[] } }
    expect(sent.state.variants).toEqual(['focus'])
  })

  it('resends when a colour value changes but every name stays the same', async () => {
    const vscode = await import('vscode')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, webview } = makeFakeView()
    captured.provider?.resolveWebviewView(view)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never

    await post(ready([{ name: 'blue', value: '#00f' }], ['hover']))
    await post(ready([{ name: 'blue', value: '#0ff' }], ['hover']))

    const sent = webview.postMessage.mock.calls.at(-1)?.[0] as {
      state: { palette: { value: string }[] }
    }
    expect(sent.state.palette[0]?.value).toBe('#0ff')
  })
})

describe('the commands the manifest promises', () => {
  it('registers exactly the commands package.json contributes', async () => {
    const { registerPanel } = await import('./panel')
    const manifest = (await import('../package.json')) as unknown as {
      contributes: { commands: { command: string }[] }
    }

    registerPanel({ subscriptions: [], extensionUri: {} } as never)

    const promised = manifest.contributes.commands.map((c) => c.command).sort()
    expect([...captured.commands.keys()].sort()).toEqual(promised)
  })
})

describe('a re-created webview gets the payload again', () => {
  it('resends the palette after the view is disposed and resolved afresh', async () => {
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(stateModule.computeState).mockResolvedValue({
      status: 'ready',
      groups: [],
      palette: [{ name: 'blue', value: '#00f' }],
      variants: ['hover'],
    })

    const first = makeFakeView()
    captured.provider?.resolveWebviewView(first.view)
    first.fireReady()
    await new Promise((resolve) => setTimeout(resolve, 0))
    first.fireDispose()

    const second = makeFakeView()
    captured.provider?.resolveWebviewView(second.view)
    second.fireReady()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const sent = second.webview.postMessage.mock.calls.at(-1)?.[0] as {
      state: { palette: unknown[] }
    }
    expect(sent.state.palette).toHaveLength(1)
  })
})

describe('the panel rests while it is hidden', () => {
  it('does no work for a cursor move the user cannot see the result of', async () => {
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, setVisible } = makeFakeView()
    captured.provider?.resolveWebviewView(view)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(stateModule.computeState).mockResolvedValue({ status: 'no-selection' })

    setVisible(false)
    vi.mocked(stateModule.computeState).mockClear()
    captured.listeners.get('selection')?.()
    await new Promise((resolve) => setTimeout(resolve, 250))

    expect(vi.mocked(stateModule.computeState)).not.toHaveBeenCalled()
  })

  it('catches up as soon as it is shown again', async () => {
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, setVisible } = makeFakeView()
    captured.provider?.resolveWebviewView(view)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(stateModule.computeState).mockResolvedValue({ status: 'no-selection' })

    setVisible(false)
    vi.mocked(stateModule.computeState).mockClear()
    setVisible(true)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(vi.mocked(stateModule.computeState)).toHaveBeenCalled()
  })
})

describe('repeated failures do not become a notification storm', () => {
  it('reports the same failure once, however many refreshes hit it', async () => {
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view } = makeFakeView()
    captured.provider?.resolveWebviewView(view)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never
    vi.mocked(stateModule.computeState).mockRejectedValue(new Error('boom'))

    for (let i = 0; i < 3; i++) {
      captured.listeners.get('selection')?.()
      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    expect(vi.mocked(vscode.window.showErrorMessage).mock.calls.length).toBe(1)
  })

  it('reports a different failure even after an earlier one', async () => {
    const vscode = await import('vscode')
    const stateModule = await import('./state')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view } = makeFakeView()
    captured.provider?.resolveWebviewView(view)
    vscode.window.activeTextEditor = makeFakeEditor(1) as never

    vi.mocked(stateModule.computeState).mockRejectedValue(new Error('first'))
    captured.listeners.get('selection')?.()
    await new Promise((resolve) => setTimeout(resolve, 250))

    vi.mocked(stateModule.computeState).mockRejectedValue(new Error('second'))
    captured.listeners.get('selection')?.()
    await new Promise((resolve) => setTimeout(resolve, 250))

    expect(vi.mocked(vscode.window.showErrorMessage).mock.calls.length).toBe(2)
  })
})

describe('undo returns focus to the editor it belongs to', () => {
  it('reuses the group the document is already in rather than opening a copy', async () => {
    const vscode = await import('vscode')
    const { registerPanel } = await import('./panel')

    registerPanel({ subscriptions: [], extensionUri: {} } as never)
    const { view, fireUndo } = makeFakeView()
    captured.provider?.resolveWebviewView(view)

    const editor = { ...makeFakeEditor(1), viewColumn: 2 }
    vscode.window.activeTextEditor = editor as never

    fireUndo()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const options = vi.mocked(vscode.window.showTextDocument).mock.calls[0]?.[1] as {
      viewColumn?: number
    }
    expect(options?.viewColumn).toBe(2)
  })
})
