import * as vscode from 'vscode'
import { createBacklog } from './backlog'
import { clearDesignSystemCache } from './design-system/load'
import type { TextEdit } from './edit/writeback'
import type { EditIntent } from './intent'
import { resolveIntent } from './intent'
import { searchClasses } from './search'
import { resolveSort } from './sort'
import { computeState } from './state'
import type { HostMessage, PanelState, WebviewMessage } from './types'

const DEBOUNCE_MS = 150
const LOADING_NOTICE_MS = 250

let generation = 0

function report(what: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error)
  void vscode.window.showErrorMessage(`twexplain could not ${what}: ${detail}`)
}

function guard(what: string, run: () => Promise<void>): void {
  run().catch((error: unknown) => report(what, error))
}

function nonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 32 }, () =>
    alphabet.charAt(Math.floor(Math.random() * alphabet.length)),
  ).join('')
}

function html(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'))
  const style = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css'))
  const codicons = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'codicon.css'))
  const n = nonce()
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${n}';">
<link href="${codicons}" rel="stylesheet">
<link href="${style}" rel="stylesheet">
</head>
<body><div id="root"></div><script nonce="${n}" src="${script}"></script></body>
</html>`
}

export function registerPanel(context: vscode.ExtensionContext): vscode.Disposable {
  const disposables: vscode.Disposable[] = []
  const backlog = createBacklog()
  let current: vscode.Webview | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let sentFingerprint: string | null = null

  let edits: Promise<unknown> = Promise.resolve()

  const serialised = (run: () => Promise<void>): Promise<void> => {
    const next = edits.then(run, run)
    edits = next.catch(() => undefined)
    return next
  }

  const post = (message: HostMessage): void => {
    void current?.postMessage(message)
  }

  const write = async (
    document: vscode.TextDocument,
    edit: TextEdit | null,
    version: number,
  ): Promise<void> => {
    if (edit === null) return
    if (document.version !== version) return
    const workspaceEdit = new vscode.WorkspaceEdit()
    workspaceEdit.replace(
      document.uri,
      new vscode.Range(document.positionAt(edit.start), document.positionAt(edit.end)),
      edit.newText,
    )
    await vscode.workspace.applyEdit(workspaceEdit)
  }

  const refresh = async (): Promise<void> => {
    const runGeneration = ++generation
    if (current === null) return
    const editor = vscode.window.activeTextEditor
    if (editor === undefined) {
      post({ type: 'state', state: { status: 'no-selection' } })
      return
    }
    const document = editor.document
    const folder = vscode.workspace.getWorkspaceFolder(document.uri)

    const slowNotice = setTimeout(() => {
      if (runGeneration !== generation) return
      post({ type: 'state', state: { status: 'loading' } })
    }, LOADING_NOTICE_MS)

    try {
      const state = await computeState({
        text: document.getText(),
        offset: document.offsetAt(editor.selection.active),
        uri: document.uri.toString(),
        workspaceRoot: folder?.uri.fsPath ?? null,
        fsPath: document.uri.fsPath,
        languageId: document.languageId,
      })
      if (runGeneration !== generation) return
      if (state.status === 'ready') backlog.record(state.groups.flatMap((g) => g.classes))
      post({ type: 'state', state: withoutRepeatedPayload(state) })
    } finally {
      clearTimeout(slowNotice)
    }
  }

  const applyIntent = async (intent: EditIntent): Promise<void> => {
    const editor = vscode.window.activeTextEditor
    if (editor === undefined) return
    const document = editor.document
    const folder = vscode.workspace.getWorkspaceFolder(document.uri)
    const version = document.version

    const edit = await resolveIntent({
      text: document.getText(),
      offset: document.offsetAt(editor.selection.active),
      uri: document.uri.toString(),
      workspaceRoot: folder?.uri.fsPath ?? null,
      fsPath: document.uri.fsPath,
      languageId: document.languageId,
      intent,
    })
    await write(document, edit, version)
  }

  const sortClasses = async (): Promise<void> => {
    const editor = vscode.window.activeTextEditor
    if (editor === undefined) return
    const document = editor.document
    const folder = vscode.workspace.getWorkspaceFolder(document.uri)
    const version = document.version

    const edit = await resolveSort({
      text: document.getText(),
      offset: document.offsetAt(editor.selection.active),
      uri: document.uri.toString(),
      workspaceRoot: folder?.uri.fsPath ?? null,
      fsPath: document.uri.fsPath,
      languageId: document.languageId,
    })
    await write(document, edit, version)
  }

  const showBacklog = async (): Promise<void> => {
    const document = await vscode.workspace.openTextDocument({
      content: backlog.report(),
      language: 'markdown',
    })
    await vscode.window.showTextDocument(document)
  }

  const undoLastEdit = async (): Promise<void> => {
    const editor = vscode.window.activeTextEditor
    if (editor === undefined) return
    await vscode.window.showTextDocument(editor.document, { preserveFocus: false })
    await vscode.commands.executeCommand('undo')
  }

  const suggest = async (query: string): Promise<void> => {
    const editor = vscode.window.activeTextEditor
    if (editor === undefined) return
    const folder = vscode.workspace.getWorkspaceFolder(editor.document.uri)

    const matches = await searchClasses(
      { workspaceRoot: folder?.uri.fsPath ?? null, fsPath: editor.document.uri.fsPath },
      query,
    )
    post({ type: 'suggestions', query, matches })
  }

  const withoutRepeatedPayload = (state: PanelState): PanelState => {
    if (state.status !== 'ready') return state
    const fingerprint = JSON.stringify([state.palette, state.variants])
    if (fingerprint === sentFingerprint) return { ...state, palette: [], variants: [] }
    sentFingerprint = fingerprint
    return state
  }

  const scheduleRefresh = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => guard('read the class string', refresh), DEBOUNCE_MS)
  }

  disposables.push(
    vscode.window.registerWebviewViewProvider('twexplain.panel', {
      resolveWebviewView(view) {
        current = view.webview
        sentFingerprint = null
        view.webview.options = { enableScripts: true }
        view.webview.html = html(view.webview, context.extensionUri)
        view.webview.onDidReceiveMessage((message: WebviewMessage) => {
          if (message.type === 'ready') guard('read the class string', refresh)
          else if (message.type === 'edit')
            guard('apply that change', () =>
              serialised(() => applyIntent(message.intent as EditIntent)),
            )
          else if (message.type === 'search')
            guard('search for classes', () => suggest(message.query))
          else if (message.type === 'undo') guard('undo', undoLastEdit)
        })
        view.onDidDispose(() => {
          current = null
          sentFingerprint = null
          if (timer !== undefined) {
            clearTimeout(timer)
            timer = undefined
          }
        })
      },
    }),
    vscode.commands.registerCommand('twexplain.sortClasses', () =>
      guard('sort the class string', () => serialised(sortClasses)),
    ),
    vscode.commands.registerCommand('twexplain.showCurationBacklog', () =>
      guard('open the curation backlog', showBacklog),
    ),
    vscode.window.onDidChangeTextEditorSelection(scheduleRefresh),
    vscode.window.onDidChangeActiveTextEditor(scheduleRefresh),
    vscode.workspace.onDidChangeTextDocument(scheduleRefresh),
  )

  const watcher = vscode.workspace.createFileSystemWatcher('**/*.css')
  const invalidate = (): void => {
    clearDesignSystemCache()
    sentFingerprint = null
    scheduleRefresh()
  }
  watcher.onDidChange(invalidate)
  watcher.onDidCreate(invalidate)
  watcher.onDidDelete(invalidate)
  disposables.push(watcher)

  return vscode.Disposable.from(...disposables)
}
