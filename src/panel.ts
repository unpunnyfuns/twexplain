import * as vscode from 'vscode'
import { clearDesignSystemCache } from './design-system/load'
import { computeState } from './state'
import type { HostMessage, WebviewMessage } from './types'

const DEBOUNCE_MS = 150

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
    if (current === null) return
    const editor = vscode.window.activeTextEditor
    if (editor === undefined) {
      post({ type: 'state', state: { status: 'no-selection' } })
      return
    }
    const document = editor.document
    const folder = vscode.workspace.getWorkspaceFolder(document.uri)
    post({
      type: 'state',
      state: await computeState({
        text: document.getText(),
        offset: document.offsetAt(editor.selection.active),
        uri: document.uri.toString(),
        workspaceRoot: folder?.uri.fsPath ?? null,
        fsPath: document.uri.fsPath,
      }),
    })
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
        })
      },
    }),
    vscode.window.onDidChangeTextEditorSelection(scheduleRefresh),
    vscode.window.onDidChangeActiveTextEditor(scheduleRefresh),
    vscode.workspace.onDidChangeTextDocument(scheduleRefresh),
  )

  const invalidate = (): void => {
    clearDesignSystemCache()
    scheduleRefresh()
  }

  // Cache misses (no-tailwind, wrong-version, no-entry, load-error) are cached in
  // loadDesignSystem with no TTL and no retry, so this watcher is the only recovery
  // path for a transient failure — not just a freshness signal.
  //
  // A CSS-only glob covers the entry file and anything it @imports (both are .css
  // files under the workspace), but it does not cover node_modules/tailwindcss
  // appearing or changing version, since that is read from its package.json, not
  // matched by '**/*.css'. A user running `npm install tailwindcss` after opening
  // the panel — a realistic first-run scenario — would otherwise be stuck on a
  // cached 'no-workspace-tailwind' failure until something else happened to clear
  // it. A second, narrowly-scoped watcher on that manifest closes that gap without
  // becoming a general dependency tracker.
  const cssWatcher = vscode.workspace.createFileSystemWatcher('**/*.css')
  cssWatcher.onDidChange(invalidate)
  cssWatcher.onDidCreate(invalidate)
  cssWatcher.onDidDelete(invalidate)
  disposables.push(cssWatcher)

  const tailwindManifestWatcher = vscode.workspace.createFileSystemWatcher(
    '**/node_modules/tailwindcss/package.json',
  )
  tailwindManifestWatcher.onDidChange(invalidate)
  tailwindManifestWatcher.onDidCreate(invalidate)
  tailwindManifestWatcher.onDidDelete(invalidate)
  disposables.push(tailwindManifestWatcher)

  return vscode.Disposable.from(...disposables)
}
