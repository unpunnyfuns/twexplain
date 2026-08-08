import { describe, expect, it } from 'vitest'
import { detectClassString } from './index'

const find = (text: string, needle: string, languageId: string) =>
  detectClassString({ text, offset: text.indexOf(needle), uri: 'file:///a', languageId })

describe('detectClassString dispatch', () => {
  it('uses the JSX detector for typescriptreact', () => {
    const found = find('<div className="flex gap-2">x</div>', 'gap-2', 'typescriptreact')
    expect(found?.kind).toBe('jsx')
    expect(found?.candidates.map((c) => c.text)).toEqual(['flex', 'gap-2'])
  })

  it('uses the JSX detector for javascriptreact', () => {
    expect(find('<div className="flex">x</div>', 'flex', 'javascriptreact')?.kind).toBe('jsx')
  })

  it('reads a plain class attribute in html', () => {
    const found = find('<div class="flex gap-2">x</div>', 'gap-2', 'html')
    expect(found?.kind).toBe('html')
    expect(found?.candidates.map((c) => c.text)).toEqual(['flex', 'gap-2'])
  })

  it('reads @apply in css', () => {
    const found = find('.btn { @apply px-4 py-2; }', 'py-2', 'css')
    expect(found?.kind).toBe('apply')
    expect(found?.candidates.map((c) => c.text)).toEqual(['px-4', 'py-2'])
  })

  it('reads a static class attribute in vue', () => {
    const found = find('<div class="flex gap-2">x</div>', 'gap-2', 'vue')
    expect(found?.kind).toBe('vue')
  })

  it('reads a bound class expression in vue', () => {
    const found = find("<div :class=\"['flex', 'gap-2']\">x</div>", 'gap-2', 'vue')
    expect(found?.kind).toBe('vue')
    expect(found?.candidates.map((c) => c.text)).toEqual(['gap-2'])
  })

  it('reads an object-syntax bound class in vue', () => {
    const found = find('<div :class="{ \'bg-red-500\': isOn }">x</div>', 'bg-red-500', 'vue')
    expect(found?.candidates.map((c) => c.text)).toEqual(['bg-red-500'])
  })

  it('reads a static class attribute in svelte', () => {
    expect(find('<div class="flex gap-2">x</div>', 'gap-2', 'svelte')?.kind).toBe('svelte')
  })

  it('reads a class expression in svelte', () => {
    const found = find('<div class={cn("flex gap-2")}>x</div>', 'gap-2', 'svelte')
    expect(found?.candidates.map((c) => c.text)).toEqual(['flex', 'gap-2'])
  })

  it('reads @apply inside a svelte style block', () => {
    const source = '<style>\n.btn { @apply px-4 py-2; }\n</style>'
    const found = find(source, 'py-2', 'svelte')
    expect(found?.candidates.map((c) => c.text)).toEqual(['px-4', 'py-2'])
  })

  it('returns null for a language it does not handle', () => {
    expect(find('<div class="flex">x</div>', 'flex', 'python')).toBeNull()
  })

  it('returns null when nothing is at the cursor', () => {
    expect(find('const x = 1', 'x', 'typescriptreact')).toBeNull()
  })
})
