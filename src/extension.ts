import type * as vscode from 'vscode'
import { registerPanel } from './panel'

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(registerPanel(context))
}

export function deactivate(): void {}
