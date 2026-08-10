/// <reference types="mocha" />
import * as assert from 'node:assert'
import * as vscode from 'vscode'
import { computeState } from '../state'

suite('twexplain integration', () => {
  test('explains classes in the fixture workspace', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0]
    assert.ok(folder, 'expected a workspace folder')

    const uri = vscode.Uri.joinPath(folder.uri, 'fixtures', 'src', 'Card.tsx')
    const document = await vscode.workspace.openTextDocument(uri)
    const text = document.getText()

    const state = await computeState({
      text,
      offset: text.indexOf('flex') + 1,
      uri: uri.toString(),
      workspaceRoot: folder.uri.fsPath,
      fsPath: uri.fsPath,
      languageId: 'typescriptreact',
    })

    assert.strictEqual(state.status, 'ready')
    if (state.status !== 'ready') return

    const all = state.groups.flatMap((g) => g.classes)
    assert.strictEqual(all.length, 5)

    const px4 = all.find((c) => c.candidate.text === 'px-4')
    assert.ok(px4)
    assert.deepStrictEqual(px4.declarations, [{ prop: 'padding-inline', value: '16px' }])

    const flex = all.find((c) => c.candidate.text === 'flex')
    assert.strictEqual(flex?.prose, 'lays children out in a row')
    assert.strictEqual(flex?.condition, null)
  })
})

suite('twexplain resolves against the workspace stylesheet', () => {
  test('uses the theme and dark strategy the fixtures declare', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0]
    assert.ok(folder, 'expected a workspace folder')

    const uri = vscode.Uri.joinPath(folder.uri, 'fixtures', 'src', 'edge-cases.tsx')
    const document = await vscode.workspace.openTextDocument(uri)
    const text = document.getText()
    const target = 'dark:bg-slate-900'

    const state = await computeState({
      text,
      offset: text.indexOf(target) + 1,
      uri: uri.toString(),
      workspaceRoot: folder.uri.fsPath,
      fsPath: uri.fsPath,
      languageId: 'typescriptreact',
    })

    assert.strictEqual(state.status, 'ready')
    if (state.status !== 'ready') return

    const dark = state.groups.flatMap((g) => g.classes).find((c) => c.candidate.text === target)
    assert.ok(dark, 'expected the dark class to be explained')

    assert.strictEqual(dark.condition, 'in dark mode')
    assert.deepStrictEqual(
      dark.declarations.map((d) => d.selector),
      ['&:where(.dark, .dark *)'],
      'the fixtures declare the class dark strategy, so the scope is a selector',
    )
  })
})
