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

describe('detectClassString svelte class directive', () => {
  it('reads the class name from a class: directive', () => {
    const source = '<div class:bg-red-500={isOn}>x</div>'
    const found = find(source, 'bg-red-500', 'svelte')

    expect(found?.kind).toBe('svelte')
    expect(found?.candidates.map((c) => c.text)).toEqual(['bg-red-500'])
  })

  it('recovers the directive class from its offsets', () => {
    const source = '<div class:px-4={on}>x</div>'
    const found = find(source, 'px-4', 'svelte')
    const candidate = found?.candidates[0]

    expect(source.slice(candidate?.range.start, candidate?.range.end)).toBe('px-4')
  })

  it('does not treat the condition as a class', () => {
    const source = '<div class:px-4={isOn}>x</div>'
    expect(find(source, 'isOn', 'svelte')).toBeNull()
  })

  it('still prefers a plain class attribute when both are present', () => {
    const source = '<div class="flex gap-2" class:px-4={on}>x</div>'
    expect(find(source, 'gap-2', 'svelte')?.candidates.map((c) => c.text)).toEqual([
      'flex',
      'gap-2',
    ])
  })
})

describe('detectClassString template literals', () => {
  it('reads the static parts of a template literal', () => {
    const source = '<div className={`flex gap-2 ${extra}`}>x</div>'
    const found = find(source, 'gap-2', 'typescriptreact')

    expect(found?.candidates.map((c) => c.text)).toEqual(['flex', 'gap-2'])
  })

  it('does not offer an interpolation as a class', () => {
    const source = '<div className={`flex ${extra}`}>x</div>'
    const found = find(source, 'flex', 'typescriptreact')

    expect(found?.candidates.map((c) => c.text)).toEqual(['flex'])
  })

  it('returns null when the cursor is inside an interpolation', () => {
    const source = '<div className={`flex ${extra}`}>x</div>'
    expect(find(source, 'extra', 'typescriptreact')).toBeNull()
  })
})

describe('detectClassString helper calls without a class attribute', () => {
  const cva = [
    'const button = cva("rounded px-4", {',
    '  variants: {',
    '    size: { sm: "px-2 text-sm", lg: "px-6 text-lg" },',
    '    tone: { danger: "bg-red-500 text-white" },',
    '  },',
    '})',
  ].join('\n')

  it('reads the base string of a cva call', () => {
    const found = find(cva, 'rounded', 'typescriptreact')
    expect(found?.candidates.map((c) => c.text)).toEqual(['rounded', 'px-4'])
  })

  it('reads a nested variant string', () => {
    const found = find(cva, 'text-sm', 'typescriptreact')
    expect(found?.candidates.map((c) => c.text)).toEqual(['px-2', 'text-sm'])
  })

  it('reads a deeply nested variant string', () => {
    const found = find(cva, 'bg-red-500', 'typescriptreact')
    expect(found?.candidates.map((c) => c.text)).toEqual(['bg-red-500', 'text-white'])
  })

  it('does not treat the variant keys as classes', () => {
    expect(find(cva, 'variants', 'typescriptreact')).toBeNull()
    expect(find(cva, 'size:', 'typescriptreact')).toBeNull()
  })

  it('reads a clsx call outside any attribute', () => {
    const source = 'const cls = clsx("flex gap-2", on && "bg-blue-600")'
    expect(find(source, 'gap-2', 'typescriptreact')?.candidates.map((c) => c.text)).toEqual([
      'flex',
      'gap-2',
    ])
  })

  it('ignores strings in calls that have nothing to do with classes', () => {
    const source = 'const label = t("some translation key")'
    expect(find(source, 'translation', 'typescriptreact')).toBeNull()
  })

  it('still prefers a class attribute when the cursor is in one', () => {
    const source = 'const x = cn("a-1")\nconst el = <div className="flex gap-2">x</div>'
    expect(find(source, 'gap-2', 'typescriptreact')?.candidates.map((c) => c.text)).toEqual([
      'flex',
      'gap-2',
    ])
  })
})

describe('detectClassString does not mistake expressions for class lists', () => {
  it('returns null for a vue bound class when the cursor is not in a string', () => {
    const source = '<div :class="{ \'bg-red-500\': isOn }">x</div>'
    expect(find(source, 'isOn', 'vue')).toBeNull()
  })

  it('returns null for a v-bind:class expression outside its strings', () => {
    const source = '<div v-bind:class="[base, extra]">x</div>'
    expect(find(source, 'extra', 'vue')).toBeNull()
  })

  it('does not read a data-class attribute as a class list', () => {
    const source = '<div data-class="not-a-class">x</div>'
    expect(find(source, 'not-a-class', 'html')).toBeNull()
  })

  it('still reads a genuine static class beside a bound one in vue', () => {
    const source = '<div class="flex gap-2" :class="[extra]">x</div>'
    expect(find(source, 'gap-2', 'vue')?.candidates.map((c) => c.text)).toEqual(['flex', 'gap-2'])
  })
})
