/// <reference types="mocha" />
import * as assert from 'node:assert'
import * as vscode from 'vscode'
import { computeState } from '../state'

suite('twexplain integration', () => {
  test('explains classes in the fixture workspace', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0]
    assert.ok(folder, 'expected a workspace folder')

    const uri = vscode.Uri.joinPath(folder.uri, 'src', 'App.tsx')
    const document = await vscode.workspace.openTextDocument(uri)
    const text = document.getText()

    const state = await computeState({
      text,
      offset: text.indexOf('flex') + 1,
      uri: uri.toString(),
      workspaceRoot: folder.uri.fsPath,
      fsPath: uri.fsPath,
    })

    assert.strictEqual(state.status, 'ready')
    if (state.status !== 'ready') return

    const all = state.groups.flatMap((g) => g.classes)
    assert.strictEqual(all.length, 2)

    const px4 = all.find((c) => c.candidate.text === 'px-4')
    assert.ok(px4)
    assert.deepStrictEqual(px4.declarations, [{ prop: 'padding-inline', value: '16px' }])

    const flex = all.find((c) => c.candidate.text === 'flex')
    assert.strictEqual(flex?.prose, 'lays children out in a row')
  })
})
