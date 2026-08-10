import * as vscode from 'vscode'
import { INITIAL_ROOT_FONT_SIZE_PX } from './explain/flatten'

export type Settings = {
  rootFontSize: number
  pixelEquivalents: boolean
  classAttributes: string[]
  classFunctions: string[]
}

export function readSettings(scope?: vscode.Uri): Settings {
  const tailwind = vscode.workspace.getConfiguration('tailwindCSS', scope)

  return {
    rootFontSize: tailwind.get<number>('rootFontSize') ?? INITIAL_ROOT_FONT_SIZE_PX,
    pixelEquivalents: tailwind.get<boolean>('showPixelEquivalents') ?? true,
    classAttributes: tailwind.get<string[]>('classAttributes') ?? [],
    classFunctions: tailwind.get<string[]>('classFunctions') ?? [],
  }
}
