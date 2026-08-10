import type { ClassStringLocation } from '../types'
import { detectApply } from './apply'
import { detectHtml } from './html'
import { detectJsx } from './jsx'
import { detectSvelte } from './svelte'
import { detectVue } from './vue'

export type DetectInput = {
  text: string
  offset: number
  uri: string
  languageId: string
  classAttributes?: string[]
  classFunctions?: string[]
}

const JSX_LANGUAGES = new Set(['typescriptreact', 'javascriptreact'])
const CSS_LANGUAGES = new Set(['css', 'postcss', 'tailwindcss'])

export function detectClassString({
  text,
  offset,
  uri,
  languageId,
  classAttributes,
  classFunctions,
}: DetectInput): ClassStringLocation | null {
  const names = { attributes: classAttributes, functions: classFunctions }

  if (JSX_LANGUAGES.has(languageId)) return detectJsx(text, offset, uri, names)
  if (CSS_LANGUAGES.has(languageId)) return detectApply(text, offset, uri)
  if (languageId === 'html') return detectHtml(text, offset, uri, names)
  if (languageId === 'vue') return detectVue(text, offset, uri, names)
  if (languageId === 'svelte') return detectSvelte(text, offset, uri, names)
  return null
}
