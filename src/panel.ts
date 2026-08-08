import * as vscode from 'vscode'
import { clearDesignSystemCache } from './design-system/load'
import type { EditIntent } from './intent'
import { resolveIntent } from './intent'
import { searchClasses } from './search'
import { computeState } from './state'
import type { HostMessage, WebviewMessage } from './types'

const DEBOUNCE_MS = 150
const LOADING_NOTICE_MS = 250

let generation = 0

function nonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 32 }, () =>
    alphabet.charAt(Math.floor(Math.random() * alphabet.length)),
  ).join('')
}

function html(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const script = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'))
  const style = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.css'))
  const n = nonce()
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${n}';">
<link href="${style}" rel="stylesheet">
</head>
<body><div id="root"></div><script nonce="${n}" src="${script}"></script></body>
</html>`
}

export function registerPanel(context: vscode.ExtensionContext): vscode.Disposable {
  const disposables: vscode.Disposable[] = []
  let current: vscode.Webview | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const post = (message: HostMessage): void => {
    void current?.postMessage(message)
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
      post({ type: 'state', state })
    } finally {
      clearTimeout(slowNotice)
    }
  }

  const applyIntent = async (intent: EditIntent): Promise<void> => {
    const editor = vscode.window.activeTextEditor
    if (editor === undefined) return
    const document = editor.document
    const folder = vscode.workspace.getWorkspaceFolder(document.uri)

    const edit = await resolveIntent({
      text: document.getText(),
      offset: document.offsetAt(editor.selection.active),
      uri: document.uri.toString(),
      workspaceRoot: folder?.uri.fsPath ?? null,
      fsPath: document.uri.fsPath,
      languageId: document.languageId,
      intent,
    })
    if (edit === null) return

    const workspaceEdit = new vscode.WorkspaceEdit()
    workspaceEdit.replace(
      document.uri,
      new vscode.Range(document.positionAt(edit.start), document.positionAt(edit.end)),
      edit.newText,
    )
    await vscode.workspace.applyEdit(workspaceEdit)
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

  const scheduleRefresh = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => void refresh(), DEBOUNCE_MS)
  }

  disposables.push(
    vscode.window.registerWebviewViewProvider('twexplain.panel', {
      resolveWebviewView(view) {
        current = view.webview
        view.webview.options = { enableScripts: true }
        view.webview.html = html(view.webview, context.extensionUri)
        view.webview.onDidReceiveMessage((message: WebviewMessage) => {
          if (message.type === 'ready') void refresh()
          else if (message.type === 'edit') void applyIntent(message.intent as EditIntent)
          else if (message.type === 'search') void suggest(message.query)
          else if (message.type === 'undo') void undoLastEdit()
        })
        view.onDidDispose(() => {
          current = null
          if (timer !== undefined) {
            clearTimeout(timer)
            timer = undefined
          }
        })
      },
    }),
    vscode.window.onDidChangeTextEditorSelection(scheduleRefresh),
    vscode.window.onDidChangeActiveTextEditor(scheduleRefresh),
    vscode.workspace.onDidChangeTextDocument(scheduleRefresh),
  )

  const watcher = vscode.workspace.createFileSystemWatcher('**/*.css')
  const invalidate = (): void => {
    clearDesignSystemCache()
    scheduleRefresh()
  }
  watcher.onDidChange(invalidate)
  watcher.onDidCreate(invalidate)
  watcher.onDidDelete(invalidate)
  disposables.push(watcher)

  return vscode.Disposable.from(...disposables)
}
