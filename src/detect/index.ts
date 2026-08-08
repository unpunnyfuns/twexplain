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
}

const JSX_LANGUAGES = new Set(['typescriptreact', 'javascriptreact'])
const CSS_LANGUAGES = new Set(['css', 'postcss', 'tailwindcss'])

export function detectClassString({
  text,
  offset,
  uri,
  languageId,
}: DetectInput): ClassStringLocation | null {
  if (JSX_LANGUAGES.has(languageId)) return detectJsx(text, offset, uri)
  if (CSS_LANGUAGES.has(languageId)) return detectApply(text, offset, uri)
  if (languageId === 'html') return detectHtml(text, offset, uri)
  if (languageId === 'vue') return detectVue(text, offset, uri)
  if (languageId === 'svelte') return detectSvelte(text, offset, uri)
  return null
}
