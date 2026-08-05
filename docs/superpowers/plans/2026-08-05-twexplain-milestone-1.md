# twexplain Milestone 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A VS Code side panel that explains the Tailwind class string under the cursor in plain English, resolved against the workspace's own Tailwind v4 design system. Read-only, JSX/TSX only.

**Architecture:** The extension host loads the workspace's Tailwind v4 design system via `__unstable__loadDesignSystem`, compiles each class candidate to CSS, then runs a pipeline — parse → strip → flatten → derive/override → group — producing explained classes posted to a React webview over a typed message protocol. A single `ClassStringLocation` type isolates framework detection from everything downstream.

**Tech Stack:** TypeScript, esbuild, React, CSS Modules, Vitest, oxlint, oxfmt, `@vscode/test-cli`, npm.

## Global Constraints

- Tailwind **v4 only**. A non-v4 major short-circuits to a notice; never attempt resolution.
- Tailwind is loaded from the **workspace's** `node_modules`, never bundled into the extension.
- The extension **never invents a description**. Unexplainable classes render raw CSS with a muted "no plain-English entry yet" note.
- **All-or-nothing prose** (owner ruling, 2026-08-05, during Task 6 review): if any single
  declaration cannot be described, `derive` returns `null` for the whole class rather than
  emitting prose covering only the describable ones. Partial prose reads as complete and so
  misleads. The accepted cost is that more classes fall back to raw CSS until the phrase
  tables grow in Milestone 4 — do not compensate by padding the tables early, since the
  fallbacks are the signal that drives curation. This supersedes the `.filter()` in Task 6's
  original `derive` code block.
- `detect/*` is the only code aware of framework syntax. Downstream consumes `ClassStringLocation` only.
- All explain-layer modules are **pure functions** with no `vscode` import, so they test under plain Vitest.
- `rem` → `px` conversion assumes a 16px root font size. This assumption lives in exactly one place (`flatten.ts`).
- No inline end-of-line comments (project style).
- Functional style; avoid classes.

## Scope

This plan covers **Milestone 1 only** from the spec. Milestones 2 (editing), 3 (remaining detectors), and 4 (curation and polish) each get their own plan.

Delivered at the end of this plan: put your cursor in a `className="..."` in a TSX file in a Tailwind v4 workspace, and a panel explains every class, grouped, with real resolved values including custom theme colours.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `esbuild.js`, `vitest.config.ts`, `.oxlintrc.json`, `.gitignore`, `.vscodeignore`, `src/extension.ts`
- Test: `src/extension.test.ts`

**Interfaces:**
- Produces: `activate(context: vscode.ExtensionContext): void`, `deactivate(): void`

- [ ] **Step 1: Initialise the package and install dependencies**

```bash
npm init -y
npm i -D typescript esbuild vitest oxlint oxfmt @types/vscode @types/node @vscode/test-cli @vscode/test-electron
npm i react react-dom
npm i -D @types/react @types/react-dom
```

- [ ] **Step 2: Write `package.json`**

Replace the generated file's relevant fields. `engines.vscode` must match the installed `@types/vscode` minor or lower.

```json
{
  "name": "twexplain",
  "displayName": "twexplain",
  "description": "Explains Tailwind class strings in a side panel",
  "version": "0.0.1",
  "private": true,
  "engines": { "vscode": "^1.99.0" },
  "categories": ["Programming Languages", "Other"],
  "activationEvents": [
    "onLanguage:typescriptreact",
    "onLanguage:javascriptreact"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "views": {
      "explorer": [
        { "type": "webview", "id": "twexplain.panel", "name": "Tailwind Inspector" }
      ]
    }
  },
  "scripts": {
    "build": "node esbuild.js",
    "watch": "node esbuild.js --watch",
    "package": "node esbuild.js --production",
    "check-types": "tsc --noEmit",
    "lint": "oxlint src",
    "format": "oxfmt src",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vscode-test"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write `esbuild.js`**

Two entry points: the extension host (Node, CJS, `vscode` external) and the webview (browser, IIFE). esbuild handles `.module.css` natively via its local-CSS support.

```js
const esbuild = require('esbuild')

const production = process.argv.includes('--production')
const watch = process.argv.includes('--watch')

const shared = {
  bundle: true,
  minify: production,
  sourcemap: !production,
  logLevel: 'info',
}

const configs = [
  {
    ...shared,
    entryPoints: ['src/extension.ts'],
    outfile: 'dist/extension.js',
    format: 'cjs',
    platform: 'node',
    external: ['vscode'],
  },
  {
    ...shared,
    entryPoints: ['src/webview/index.tsx'],
    outfile: 'dist/webview.js',
    format: 'iife',
    platform: 'browser',
    loader: { '.module.css': 'local-css' },
  },
]

async function main() {
  if (watch) {
    const ctxs = await Promise.all(configs.map((c) => esbuild.context(c)))
    await Promise.all(ctxs.map((c) => c.watch()))
    return
  }
  await Promise.all(configs.map((c) => esbuild.build(c)))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 5: Write `vitest.config.ts`**

Integration tests run under `vscode-test`, not Vitest, so exclude them.

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.integration.test.ts'],
    environment: 'node',
  },
})
```

- [ ] **Step 6: Write `.gitignore` and `.vscodeignore`**

`.gitignore`:
```
node_modules
dist
out
.vscode-test
```

`.vscodeignore`:
```
src/**
node_modules/**
docs/**
esbuild.js
tsconfig.json
vitest.config.ts
**/*.test.ts
```

- [ ] **Step 7: Write the failing test**

`src/extension.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('vscode', () => ({ window: { registerWebviewViewProvider: vi.fn() } }))

describe('activate', () => {
  it('is callable and registers nothing that throws', async () => {
    const { activate } = await import('./extension')
    expect(() => activate({ subscriptions: [] } as never)).not.toThrow()
  })
})
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npx vitest run src/extension.test.ts`
Expected: FAIL — cannot resolve `./extension`.

- [ ] **Step 9: Write minimal implementation**

`src/extension.ts`:
```ts
import type * as vscode from 'vscode'

export function activate(_context: vscode.ExtensionContext): void {}

export function deactivate(): void {}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npx vitest run src/extension.test.ts`
Expected: PASS

- [ ] **Step 11: Verify build and types**

Run: `npm run check-types && npm run build`
Expected: both succeed. `src/webview/index.tsx` does not exist yet, so temporarily comment out the webview config entry in `esbuild.js`, or create a one-line placeholder `src/webview/index.tsx` containing `export {}`. Prefer the placeholder.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold twexplain extension"
```

---

### Task 2: Core types

**Files:**
- Create: `src/types.ts`
- Test: none — types only, verified by `tsc`

**Interfaces:**
- Produces: `ClassStringLocation`, `Candidate`, `ExplainedClass`, `ExplainGroup`, `GroupName`, `Declaration`, `PanelState`, `HostMessage`, `WebviewMessage`

- [ ] **Step 1: Write `src/types.ts`**

Ranges are plain offsets, not `vscode.Range`, so the explain layer stays free of the `vscode` import.

```ts
export type Offsets = { start: number; end: number }

export type Candidate = {
  text: string
  range: Offsets
  index: number
}

export type ClassStringLocation = {
  uri: string
  range: Offsets
  kind: 'jsx' | 'html' | 'vue' | 'svelte' | 'apply'
  candidates: Candidate[]
}

export type Declaration = { prop: string; value: string }

export type GroupName =
  | 'layout'
  | 'spacing'
  | 'typography'
  | 'color'
  | 'border'
  | 'effects'
  | 'state'
  | 'other'

export type ExplainedClass = {
  candidate: Candidate
  valid: boolean
  declarations: Declaration[]
  prose: string | null
  group: GroupName
  variants: string[]
  swatch: string | null
}

export type ExplainGroup = { name: GroupName; classes: ExplainedClass[] }

export type PanelState =
  | { status: 'no-workspace-tailwind' }
  | { status: 'wrong-version'; found: string }
  | { status: 'no-css-entry' }
  | { status: 'load-error'; message: string }
  | { status: 'no-selection' }
  | { status: 'ready'; groups: ExplainGroup[] }

export type HostMessage = { type: 'state'; state: PanelState }

export type WebviewMessage = { type: 'ready' }
```

- [ ] **Step 2: Verify types compile**

Run: `npm run check-types`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add core types"
```

---

### Task 3: CSS block parser

**Files:**
- Create: `src/css/parse.ts`
- Test: `src/css/parse.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `parseCss(css: string): CssNode[]` where
  `type CssNode = { type: 'rule'; selector: string; children: CssNode[] } | { type: 'decl'; prop: string; value: string }`

Tailwind's generated CSS is regular and small, so a ~50-line parser beats a PostCSS dependency. It must handle nesting (`&:hover { @media … { … } }`) and parentheses inside values (`calc(…)`, `rect(0, 0, 0, 0)`).

- [ ] **Step 1: Write the failing test**

`src/css/parse.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseCss } from './parse'

describe('parseCss', () => {
  it('parses flat declarations', () => {
    expect(parseCss('.flex {\n  display: flex;\n}')).toEqual([
      {
        type: 'rule',
        selector: '.flex',
        children: [{ type: 'decl', prop: 'display', value: 'flex' }],
      },
    ])
  })

  it('parses nested rules', () => {
    const css = '.a {\n  &:hover {\n    @media (hover: hover) {\n      color: red;\n    }\n  }\n}'
    expect(parseCss(css)).toEqual([
      {
        type: 'rule',
        selector: '.a',
        children: [
          {
            type: 'rule',
            selector: '&:hover',
            children: [
              {
                type: 'rule',
                selector: '@media (hover: hover)',
                children: [{ type: 'decl', prop: 'color', value: 'red' }],
              },
            ],
          },
        ],
      },
    ])
  })

  it('does not split on semicolons or braces inside parentheses', () => {
    const css = '.a { clip: rect(0, 0, 0, 0); padding: calc(var(--x) * 4); }'
    expect(parseCss(css)[0]).toMatchObject({
      children: [
        { prop: 'clip', value: 'rect(0, 0, 0, 0)' },
        { prop: 'padding', value: 'calc(var(--x) * 4)' },
      ],
    })
  })

  it('parses @property blocks as rules', () => {
    const css = '@property --tw-shadow {\n  syntax: "*";\n  inherits: false;\n}'
    expect(parseCss(css)[0]).toMatchObject({ type: 'rule', selector: '@property --tw-shadow' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/css/parse.test.ts`
Expected: FAIL — cannot resolve `./parse`.

- [ ] **Step 3: Write the implementation**

`src/css/parse.ts`:
```ts
export type CssNode =
  | { type: 'rule'; selector: string; children: CssNode[] }
  | { type: 'decl'; prop: string; value: string }

export function parseCss(css: string): CssNode[] {
  let i = 0

  const skipWhitespace = (): void => {
    while (i < css.length && /\s/.test(css[i] as string)) i++
  }

  const readHead = (): string => {
    const start = i
    let depth = 0
    while (i < css.length) {
      const c = css[i] as string
      if (depth === 0 && (c === '{' || c === ';')) break
      if (c === '(') depth++
      else if (c === ')') depth--
      i++
    }
    return css.slice(start, i).trim()
  }

  const parseBlock = (): CssNode[] => {
    const out: CssNode[] = []
    for (;;) {
      skipWhitespace()
      if (i >= css.length || css[i] === '}') return out
      const head = readHead()
      if (css[i] === '{') {
        i++
        const children = parseBlock()
        skipWhitespace()
        if (css[i] === '}') i++
        out.push({ type: 'rule', selector: head, children })
        continue
      }
      if (css[i] === ';') i++
      if (!head) continue
      const colon = head.indexOf(':')
      if (colon === -1) continue
      out.push({
        type: 'decl',
        prop: head.slice(0, colon).trim(),
        value: head.slice(colon + 1).trim(),
      })
    }
  }

  return parseBlock()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/css/parse.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/css/parse.ts src/css/parse.test.ts
git commit -m "feat: add CSS block parser"
```

---

### Task 4: Strip stage

**Files:**
- Create: `src/explain/strip.ts`
- Test: `src/explain/strip.test.ts`

**Interfaces:**
- Consumes: `CssNode` from `src/css/parse.ts`
- Produces: `strip(nodes: CssNode[]): CssNode[]`

Removes `@property` blocks and `--tw-*` declarations. Rules left empty are dropped. This is mandatory, not an optimisation — without it every shadow, ring, and transform class emits its internals into the explanation.

- [ ] **Step 1: Write the failing test**

`src/explain/strip.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parseCss } from '../css/parse'
import { strip } from './strip'

describe('strip', () => {
  it('removes @property blocks', () => {
    const css = '.a { color: red; }\n@property --tw-shadow { syntax: "*"; }'
    expect(strip(parseCss(css))).toHaveLength(1)
  })

  it('removes --tw-* declarations but keeps others', () => {
    const css = '.a { --tw-shadow: 0 1px 2px black; box-shadow: var(--tw-shadow); }'
    expect(strip(parseCss(css))[0]).toMatchObject({
      children: [{ prop: 'box-shadow', value: 'var(--tw-shadow)' }],
    })
  })

  it('drops rules left empty after stripping', () => {
    const css = '.a { --tw-only: 1; }'
    expect(strip(parseCss(css))).toEqual([])
  })

  it('strips recursively through nested rules', () => {
    const css = '.a { &:hover { --tw-x: 1; color: red; } }'
    expect(strip(parseCss(css))[0]).toMatchObject({
      children: [{ selector: '&:hover', children: [{ prop: 'color', value: 'red' }] }],
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/explain/strip.test.ts`
Expected: FAIL — cannot resolve `./strip`.

- [ ] **Step 3: Write the implementation**

`src/explain/strip.ts`:
```ts
import type { CssNode } from '../css/parse'

export function strip(nodes: CssNode[]): CssNode[] {
  const out: CssNode[] = []
  for (const node of nodes) {
    if (node.type === 'decl') {
      if (node.prop.startsWith('--tw-')) continue
      out.push(node)
      continue
    }
    if (node.selector.startsWith('@property')) continue
    const children = strip(node.children)
    if (children.length > 0) out.push({ ...node, children })
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/explain/strip.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/explain/strip.ts src/explain/strip.test.ts
git commit -m "feat: add strip stage"
```

---

### Task 5: Flatten stage

**Files:**
- Create: `src/explain/flatten.ts`
- Test: `src/explain/flatten.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type ResolveTheme = (key: string) => string | null`
  - `flattenValue(value: string, resolve: ResolveTheme): string`
  - `remToPx(value: string): string`

Compiled CSS is unresolved: `px-4` yields `padding-inline: calc(var(--spacing) * 4)`. This stage substitutes theme variables, evaluates `calc()`, and converts `rem` to `px`.

Unresolvable `--tw-*` references are deliberately **left in place** — their presence is the tier-3 signal consumed by Task 6.

The 16px root font size assumption lives here and nowhere else.

- [ ] **Step 1: Write the failing test**

`src/explain/flatten.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { flattenValue, remToPx } from './flatten'

const theme: Record<string, string> = {
  '--spacing': '0.25rem',
  '--radius-md': '0.375rem',
  '--color-brand-600': '#4f46e5',
}
const resolve = (k: string): string | null => theme[k] ?? null

describe('flattenValue', () => {
  it('substitutes a theme variable', () => {
    expect(flattenValue('var(--color-brand-600)', resolve)).toBe('#4f46e5')
  })

  it('evaluates multiplication through a substituted variable', () => {
    expect(flattenValue('calc(var(--spacing) * 4)', resolve)).toBe('1rem')
  })

  it('evaluates unspaced fractions', () => {
    expect(flattenValue('calc(1/2 * 100%)', resolve)).toBe('50%')
  })

  it('uses the fallback when a variable is unresolvable', () => {
    expect(flattenValue('var(--nope, 3px)', resolve)).toBe('3px')
  })

  it('leaves unresolvable --tw-* references intact as a tier-3 signal', () => {
    expect(flattenValue('var(--tw-shadow)', resolve)).toBe('var(--tw-shadow)')
  })

  it('leaves non-arithmetic values alone', () => {
    expect(flattenValue('oklch(48.8% 0.243 264.376)', resolve)).toBe(
      'oklch(48.8% 0.243 264.376)',
    )
  })
})

describe('remToPx', () => {
  it('converts rem to px at a 16px root', () => {
    expect(remToPx('1rem')).toBe('16px')
    expect(remToPx('0.375rem')).toBe('6px')
  })

  it('leaves other units alone', () => {
    expect(remToPx('50%')).toBe('50%')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/explain/flatten.test.ts`
Expected: FAIL — cannot resolve `./flatten`.

- [ ] **Step 3: Write the implementation**

`src/explain/flatten.ts`:
```ts
export type ResolveTheme = (key: string) => string | null

const ROOT_FONT_SIZE_PX = 16
const VAR_PATTERN = /var\((--[\w-]+)(?:,([^()]*))?\)/g
const CALC_PATTERN = /calc\(([^()]*)\)/
const DIMENSION = /^(-?[\d.]+)([a-z%]*)$/
const FRACTION = /^(-?[\d.]+)\/(-?[\d.]+)$/

function evaluateFraction(token: string): string {
  const match = FRACTION.exec(token)
  if (!match) return token
  const numerator = Number.parseFloat(match[1] as string)
  const denominator = Number.parseFloat(match[2] as string)
  if (denominator === 0) return token
  return String(numerator / denominator)
}

function evaluateExpression(expression: string): string | null {
  const tokens = expression.trim().split(/\s+/).map(evaluateFraction)
  if (tokens.length === 1) return tokens[0] as string
  if (tokens.length !== 3) return null

  const [left, operator, right] = tokens as [string, string, string]
  const leftMatch = DIMENSION.exec(left)
  const rightMatch = DIMENSION.exec(right)
  if (!leftMatch || !rightMatch) return null

  const leftUnit = leftMatch[2] as string
  const rightUnit = rightMatch[2] as string
  if (leftUnit && rightUnit && leftUnit !== rightUnit) return null

  const a = Number.parseFloat(leftMatch[1] as string)
  const b = Number.parseFloat(rightMatch[1] as string)

  let result: number
  if (operator === '*') result = a * b
  else if (operator === '/') result = b === 0 ? Number.NaN : a / b
  else if (operator === '+') result = a + b
  else if (operator === '-') result = a - b
  else return null
  if (Number.isNaN(result)) return null

  return `${Number.parseFloat(result.toFixed(6))}${leftUnit || rightUnit}`
}

function evaluateCalc(value: string): string {
  let current = value
  for (let guard = 0; guard < 20; guard++) {
    const match = CALC_PATTERN.exec(current)
    if (!match) return current
    const evaluated = evaluateExpression(match[1] as string)
    if (evaluated === null) return current
    current =
      current.slice(0, match.index) + evaluated + current.slice(match.index + match[0].length)
  }
  return current
}

export function flattenValue(value: string, resolve: ResolveTheme): string {
  let current = value
  for (let guard = 0; guard < 10; guard++) {
    const substituted = current.replace(VAR_PATTERN, (whole, name: string, fallback?: string) => {
      const resolved = resolve(name)
      if (resolved !== null) return resolved
      if (fallback !== undefined) return fallback.trim()
      return whole
    })
    const next = evaluateCalc(substituted)
    if (next === current) return current
    current = next
  }
  return current
}

export function remToPx(value: string): string {
  return value.replace(
    /(-?[\d.]+)rem\b/g,
    (_, n: string) => `${Number.parseFloat((Number.parseFloat(n) * ROOT_FONT_SIZE_PX).toFixed(4))}px`,
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/explain/flatten.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/explain/flatten.ts src/explain/flatten.test.ts
git commit -m "feat: add flatten stage"
```

---

### Task 6: Derive stage

**Files:**
- Create: `src/explain/derive.ts`
- Test: `src/explain/derive.test.ts`

**Interfaces:**
- Consumes: `Declaration` from `src/types.ts`
- Produces:
  - `isOpaque(declarations: Declaration[]): boolean`
  - `derive(declarations: Declaration[]): string | null`

`isOpaque` returns `true` when any declaration still contains an unresolved `--tw-*` reference after flattening. Verified against Tailwind 4.1.7: this catches `shadow-lg` and `space-x-4` with no hand-maintained list.

`derive` returns `null` for opaque input — the caller falls back to raw CSS. It never guesses.

- [ ] **Step 1: Write the failing test**

`src/explain/derive.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { derive, isOpaque } from './derive'

describe('isOpaque', () => {
  it('flags declarations with residual --tw-* references', () => {
    expect(isOpaque([{ prop: 'box-shadow', value: 'var(--tw-shadow)' }])).toBe(true)
  })

  it('does not flag fully resolved declarations', () => {
    expect(isOpaque([{ prop: 'padding-inline', value: '16px' }])).toBe(false)
  })
})

describe('derive', () => {
  it('describes a known property', () => {
    expect(derive([{ prop: 'display', value: 'flex' }])).toBe('lays children out in a row')
  })

  it('describes a dimensional property with its value', () => {
    expect(derive([{ prop: 'padding-inline', value: '16px' }])).toBe(
      'padding of 16px on the left and right',
    )
  })

  it('joins multiple declarations', () => {
    expect(derive([
      { prop: 'font-size', value: '14px' },
      { prop: 'line-height', value: '1.428571' },
    ])).toBe('text size 14px; line height 1.428571')
  })

  it('returns null for opaque declarations', () => {
    expect(derive([{ prop: 'box-shadow', value: 'var(--tw-shadow)' }])).toBeNull()
  })

  it('returns null when no property is known', () => {
    expect(derive([{ prop: 'nonsense-prop', value: '1' }])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/explain/derive.test.ts`
Expected: FAIL — cannot resolve `./derive`.

- [ ] **Step 3: Write the implementation**

`src/explain/derive.ts`. The `PHRASES` table starts with the entries below; Milestone 4 extends it to roughly 80 properties.

```ts
import type { Declaration } from '../types'

type Phrase = string | ((value: string) => string)

const EXACT: Record<string, Record<string, string>> = {
  display: {
    flex: 'lays children out in a row',
    grid: 'lays children out on a grid',
    block: 'takes the full width available',
    'inline-flex': 'lays children out in a row, sitting inline',
    none: 'hidden entirely',
  },
  position: {
    absolute: 'positioned against its nearest positioned ancestor',
    relative: 'positioned normally, but anchors absolute children',
    fixed: 'pinned to the viewport',
    sticky: 'sticks in place when scrolled past',
  },
  overflow: {
    hidden: 'clips anything overflowing',
    auto: 'scrolls when content overflows',
  },
}

const PHRASES: Record<string, Phrase> = {
  'align-items': (v) => `children centered on the cross axis (${v})`,
  'justify-content': (v) => `children distributed along the main axis (${v})`,
  gap: (v) => `${v} between children`,
  padding: (v) => `padding of ${v} on all sides`,
  'padding-inline': (v) => `padding of ${v} on the left and right`,
  'padding-block': (v) => `padding of ${v} on the top and bottom`,
  margin: (v) => `margin of ${v} on all sides`,
  'border-radius': (v) => `corners rounded by ${v}`,
  'border-width': (v) => `${v} border`,
  'background-color': (v) => `background ${v}`,
  color: (v) => `text ${v}`,
  'font-size': (v) => `text size ${v}`,
  'line-height': (v) => `line height ${v}`,
  'font-weight': (v) => `font weight ${v}`,
  width: (v) => `width ${v}`,
  height: (v) => `height ${v}`,
  opacity: (v) => `${Math.round(Number.parseFloat(v) * 100)}% opaque`,
  'white-space': (v) => `whitespace handling: ${v}`,
}

export function isOpaque(declarations: Declaration[]): boolean {
  return declarations.some((d) => d.value.includes('--tw-'))
}

function phraseFor(declaration: Declaration): string | null {
  const exact = EXACT[declaration.prop]?.[declaration.value]
  if (exact !== undefined) return exact
  const phrase = PHRASES[declaration.prop]
  if (phrase === undefined) return null
  return typeof phrase === 'string' ? phrase : phrase(declaration.value)
}

export function derive(declarations: Declaration[]): string | null {
  if (isOpaque(declarations)) return null
  const parts = declarations.map(phraseFor).filter((p): p is string => p !== null)
  if (parts.length === 0) return null
  return parts.join('; ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/explain/derive.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/explain/derive.ts src/explain/derive.test.ts
git commit -m "feat: add derive stage"
```

---

### Task 7: Curated overrides

**Files:**
- Create: `src/explain/overrides.ts`
- Test: `src/explain/overrides.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `overrideFor(root: string): string | null`

Handles the tier-3 classes `isOpaque` cannot detect: those whose declarations are individually derivable but whose combined meaning is emergent. `sr-only` flattens to nine ordinary declarations, yet "position absolute, 1px by 1px, clipped" describes mechanism rather than purpose.

Keyed by candidate **root**, not full class name, so `shadow-lg` and `shadow-sm` share one entry.

- [ ] **Step 1: Write the failing test**

`src/explain/overrides.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { overrideFor } from './overrides'

describe('overrideFor', () => {
  it('explains emergent-meaning utilities by purpose', () => {
    expect(overrideFor('sr-only')).toBe(
      'visually hidden, but still announced by screen readers',
    )
  })

  it('explains composite utilities the derive stage cannot resolve', () => {
    expect(overrideFor('shadow')).toBe('drop shadow')
    expect(overrideFor('space-x')).toBe('horizontal gap between children, except the last')
  })

  it('returns null for roots with no curated entry', () => {
    expect(overrideFor('px')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/explain/overrides.test.ts`
Expected: FAIL — cannot resolve `./overrides`.

- [ ] **Step 3: Write the implementation**

`src/explain/overrides.ts`. Milestone 4 grows this from the backlog command; a missing entry degrades to mechanical prose or raw CSS, never an error.

```ts
const OVERRIDES: Record<string, string> = {
  'sr-only': 'visually hidden, but still announced by screen readers',
  'not-sr-only': 'undoes sr-only, making the element visible again',
  truncate: 'one line, cut off with an ellipsis',
  antialiased: 'smoother font rendering',
  isolate: 'creates a new stacking context',
  shadow: 'drop shadow',
  'inset-shadow': 'inner drop shadow',
  ring: 'outline ring drawn outside the border',
  'space-x': 'horizontal gap between children, except the last',
  'space-y': 'vertical gap between children, except the last',
  divide: 'dividing lines drawn between children',
  animate: 'runs a named animation',
  transform: 'applies a geometric transform',
  filter: 'applies a visual filter',
  'backdrop-filter': 'applies a filter to what is behind the element',
}

export function overrideFor(root: string): string | null {
  return OVERRIDES[root] ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/explain/overrides.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/explain/overrides.ts src/explain/overrides.test.ts
git commit -m "feat: add curated overrides"
```

---

### Task 8: Group stage

**Files:**
- Create: `src/explain/group.ts`
- Test: `src/explain/group.test.ts`

**Interfaces:**
- Consumes: `Declaration`, `GroupName`, `ExplainedClass`, `ExplainGroup` from `src/types.ts`
- Produces:
  - `groupFor(declarations: Declaration[], variants: string[]): GroupName`
  - `groupAll(classes: ExplainedClass[]): ExplainGroup[]`

A class with any variant goes to `state` regardless of its properties — `hover:bg-blue-700` belongs with the other hover behaviour, not with the static colours.

- [ ] **Step 1: Write the failing test**

`src/explain/group.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { ExplainedClass } from '../types'
import { groupAll, groupFor } from './group'

const explained = (name: string, group: ExplainedClass['group']): ExplainedClass => ({
  candidate: { text: name, range: { start: 0, end: name.length }, index: 0 },
  valid: true,
  declarations: [],
  prose: null,
  group,
  variants: [],
  swatch: null,
})

describe('groupFor', () => {
  it('routes variant-bearing classes to state', () => {
    expect(groupFor([{ prop: 'background-color', value: 'red' }], ['hover'])).toBe('state')
  })

  it('routes by property when there are no variants', () => {
    expect(groupFor([{ prop: 'display', value: 'flex' }], [])).toBe('layout')
    expect(groupFor([{ prop: 'padding-inline', value: '16px' }], [])).toBe('spacing')
    expect(groupFor([{ prop: 'background-color', value: 'red' }], [])).toBe('color')
    expect(groupFor([{ prop: 'font-size', value: '14px' }], [])).toBe('typography')
    expect(groupFor([{ prop: 'border-radius', value: '6px' }], [])).toBe('border')
    expect(groupFor([{ prop: 'box-shadow', value: 'none' }], [])).toBe('effects')
  })

  it('falls back to other for unknown properties', () => {
    expect(groupFor([{ prop: 'nonsense', value: '1' }], [])).toBe('other')
  })
})

describe('groupAll', () => {
  it('buckets classes and drops empty groups', () => {
    const result = groupAll([explained('flex', 'layout'), explained('px-4', 'spacing')])
    expect(result.map((g) => g.name)).toEqual(['layout', 'spacing'])
  })

  it('preserves canonical group order regardless of input order', () => {
    const result = groupAll([explained('px-4', 'spacing'), explained('flex', 'layout')])
    expect(result.map((g) => g.name)).toEqual(['layout', 'spacing'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/explain/group.test.ts`
Expected: FAIL — cannot resolve `./group`.

- [ ] **Step 3: Write the implementation**

`src/explain/group.ts`:
```ts
import type { Declaration, ExplainGroup, ExplainedClass, GroupName } from '../types'

const GROUP_ORDER: GroupName[] = [
  'layout',
  'spacing',
  'typography',
  'color',
  'border',
  'effects',
  'state',
  'other',
]

const PREFIX_GROUPS: [RegExp, GroupName][] = [
  [/^(display|position|top|right|bottom|left|inset|z-index|float|clear|flex|grid|align|justify|place|order|overflow|visibility)/, 'layout'],
  [/^(padding|margin|gap|row-gap|column-gap|width|height|min-|max-|space)/, 'spacing'],
  [/^(font|line-height|letter-spacing|text|white-space|word|list-style|vertical-align)/, 'typography'],
  [/^(color|background|fill|stroke|accent|caret)/, 'color'],
  [/^(border|outline|ring|divide)/, 'border'],
  [/^(box-shadow|opacity|filter|backdrop|mix-blend|transform|transition|animation|clip|mask)/, 'effects'],
]

export function groupFor(declarations: Declaration[], variants: string[]): GroupName {
  if (variants.length > 0) return 'state'
  for (const declaration of declarations) {
    for (const [pattern, group] of PREFIX_GROUPS) {
      if (pattern.test(declaration.prop)) return group
    }
  }
  return 'other'
}

export function groupAll(classes: ExplainedClass[]): ExplainGroup[] {
  return GROUP_ORDER.map((name) => ({
    name,
    classes: classes.filter((c) => c.group === name),
  })).filter((group) => group.classes.length > 0)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/explain/group.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/explain/group.ts src/explain/group.test.ts
git commit -m "feat: add group stage"
```

---

### Task 9: Explain pipeline

**Files:**
- Create: `src/explain/index.ts`
- Test: `src/explain/index.test.ts`

**Interfaces:**
- Consumes: `parseCss`, `strip`, `flattenValue`, `remToPx`, `derive`, `isOpaque`, `overrideFor`, `groupFor`, `groupAll`
- Produces:
  - `type DesignSystemPort = { candidatesToCss(c: string[]): (string | null)[]; parseCandidate(c: string): { root: string; variants: { root: string }[] }[]; resolveThemeValue(key: string): string | undefined }`
  - `explainCandidates(candidates: Candidate[], ds: DesignSystemPort): ExplainGroup[]`

`DesignSystemPort` is a narrow structural interface over the parts of Tailwind's design system this layer needs. It exists so the pipeline can be tested with a hand-written fake, no Tailwind install required.

Precedence: curated override wins, then derived prose, then `null` (caller shows raw CSS).

- [ ] **Step 1: Write the failing test**

`src/explain/index.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { Candidate } from '../types'
import { type DesignSystemPort, explainCandidates } from './index'

const candidate = (text: string, index: number): Candidate => ({
  text,
  range: { start: 0, end: text.length },
  index,
})

const theme: Record<string, string> = { '--spacing': '0.25rem', '--color-brand-600': '#4f46e5' }

const fakeDs: DesignSystemPort = {
  candidatesToCss: (cs) =>
    cs.map((c) => {
      if (c === 'px-4') return '.px-4 { padding-inline: calc(var(--spacing) * 4); }'
      if (c === 'flex') return '.flex { display: flex; }'
      if (c === 'bg-brand-600') return '.bg-brand-600 { background-color: var(--color-brand-600); }'
      if (c === 'sr-only') return '.sr-only { position: absolute; width: 1px; }'
      if (c === 'shadow-lg') return '.shadow-lg { box-shadow: var(--tw-shadow); }'
      return null
    }),
  parseCandidate: (c) => [{ root: c.replace(/-\d+$|-lg$|-600$/, ''), variants: [] }],
  resolveThemeValue: (k) => theme[k],
}

describe('explainCandidates', () => {
  it('resolves values through the theme, including custom colours', () => {
    const groups = explainCandidates([candidate('bg-brand-600', 0)], fakeDs)
    const explained = groups[0]?.classes[0]
    expect(explained?.declarations).toEqual([
      { prop: 'background-color', value: '#4f46e5' },
    ])
    expect(explained?.swatch).toBe('#4f46e5')
  })

  it('converts spacing arithmetic to px', () => {
    const groups = explainCandidates([candidate('px-4', 0)], fakeDs)
    expect(groups[0]?.classes[0]?.declarations).toEqual([
      { prop: 'padding-inline', value: '16px' },
    ])
  })

  it('prefers a curated override over derived prose', () => {
    const groups = explainCandidates([candidate('sr-only', 0)], fakeDs)
    expect(groups[0]?.classes[0]?.prose).toBe(
      'visually hidden, but still announced by screen readers',
    )
  })

  it('falls back to derived prose when no override exists', () => {
    const groups = explainCandidates([candidate('flex', 0)], fakeDs)
    expect(groups[0]?.classes[0]?.prose).toBe('lays children out in a row')
  })

  it('marks unknown classes invalid rather than guessing', () => {
    const groups = explainCandidates([candidate('nope-999', 0)], fakeDs)
    const explained = groups[0]?.classes[0]
    expect(explained?.valid).toBe(false)
    expect(explained?.prose).toBeNull()
  })

  it('never invents prose for opaque classes without an override', () => {
    const ds: DesignSystemPort = { ...fakeDs, parseCandidate: () => [{ root: 'unknown', variants: [] }] }
    const groups = explainCandidates([candidate('shadow-lg', 0)], ds)
    expect(groups[0]?.classes[0]?.prose).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/explain/index.test.ts`
Expected: FAIL — cannot resolve `./index`.

- [ ] **Step 3: Write the implementation**

`src/explain/index.ts`:
```ts
import { type CssNode, parseCss } from '../css/parse'
import type { Candidate, Declaration, ExplainGroup, ExplainedClass } from '../types'
import { derive } from './derive'
import { flattenValue, remToPx } from './flatten'
import { groupAll, groupFor } from './group'
import { overrideFor } from './overrides'
import { strip } from './strip'

export type DesignSystemPort = {
  candidatesToCss(candidates: string[]): (string | null)[]
  parseCandidate(candidate: string): { root: string; variants: { root: string }[] }[]
  resolveThemeValue(key: string): string | undefined
}

const COLOR_PROPS = new Set(['background-color', 'color', 'border-color', 'fill', 'stroke'])

function collectDeclarations(nodes: CssNode[], out: Declaration[]): void {
  for (const node of nodes) {
    if (node.type === 'decl') out.push(node)
    else collectDeclarations(node.children, out)
  }
}

function swatchFrom(declarations: Declaration[]): string | null {
  const found = declarations.find((d) => COLOR_PROPS.has(d.prop))
  if (found === undefined) return null
  if (found.value.includes('--tw-')) return null
  return found.value
}

export function explainCandidates(
  candidates: Candidate[],
  ds: DesignSystemPort,
): ExplainGroup[] {
  const compiled = ds.candidatesToCss(candidates.map((c) => c.text))
  const resolve = (key: string): string | null => ds.resolveThemeValue(key) ?? null

  const explained: ExplainedClass[] = candidates.map((candidate, i) => {
    const css = compiled[i]
    if (css === null || css === undefined) {
      return {
        candidate,
        valid: false,
        declarations: [],
        prose: null,
        group: 'other',
        variants: [],
        swatch: null,
      }
    }

    const raw: Declaration[] = []
    collectDeclarations(strip(parseCss(css)), raw)
    const declarations = raw.map((d) => ({
      prop: d.prop,
      value: remToPx(flattenValue(d.value, resolve)),
    }))

    const parsed = ds.parseCandidate(candidate.text)[0]
    const variants = parsed?.variants.map((v) => v.root) ?? []
    const prose = (parsed ? overrideFor(parsed.root) : null) ?? derive(declarations)

    return {
      candidate,
      valid: true,
      declarations,
      prose,
      group: groupFor(declarations, variants),
      variants,
      swatch: swatchFrom(declarations),
    }
  })

  return groupAll(explained)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/explain/index.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/explain/index.ts src/explain/index.test.ts
git commit -m "feat: add explain pipeline"
```

---

### Task 10: Tailwind version detection and CSS entry discovery

**Files:**
- Create: `src/design-system/version.ts`, `src/design-system/discover.ts`
- Test: `src/design-system/version.test.ts`, `src/design-system/discover.test.ts`
- Create fixtures: `src/design-system/__fixtures__/standard/`, `src/design-system/__fixtures__/monorepo/`, `src/design-system/__fixtures__/none/`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `readTailwindVersion(workspaceRoot: string): Promise<string | null>`
  - `isSupportedVersion(version: string): boolean`
  - `discoverCssEntry(workspaceRoot: string, activeFile: string): Promise<string | null>`

`discoverCssEntry` finds CSS files containing `@import "tailwindcss"`. With several matches it picks the one whose directory shares the longest path prefix with the active file.

- [ ] **Step 1: Create the fixture workspaces**

```bash
mkdir -p src/design-system/__fixtures__/standard/{src,node_modules/tailwindcss}
mkdir -p src/design-system/__fixtures__/monorepo/{apps/web/src,apps/docs/src,node_modules/tailwindcss}
mkdir -p src/design-system/__fixtures__/none/src

printf '{"version":"4.1.7"}' > src/design-system/__fixtures__/standard/node_modules/tailwindcss/package.json
printf '@import "tailwindcss";\n' > src/design-system/__fixtures__/standard/src/app.css

printf '{"version":"3.4.17"}' > src/design-system/__fixtures__/monorepo/node_modules/tailwindcss/package.json
printf '@import "tailwindcss";\n' > src/design-system/__fixtures__/monorepo/apps/web/src/web.css
printf '@import "tailwindcss";\n' > src/design-system/__fixtures__/monorepo/apps/docs/src/docs.css

printf 'body { color: red; }\n' > src/design-system/__fixtures__/none/src/plain.css
```

- [ ] **Step 2: Write the failing tests**

`src/design-system/version.test.ts`:
```ts
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isSupportedVersion, readTailwindVersion } from './version'

const fixture = (name: string): string => join(__dirname, '__fixtures__', name)

describe('readTailwindVersion', () => {
  it('reads the installed version', async () => {
    expect(await readTailwindVersion(fixture('standard'))).toBe('4.1.7')
  })

  it('returns null when tailwind is not installed', async () => {
    expect(await readTailwindVersion(fixture('none'))).toBeNull()
  })
})

describe('isSupportedVersion', () => {
  it('accepts v4', () => {
    expect(isSupportedVersion('4.1.7')).toBe(true)
    expect(isSupportedVersion('4.0.0')).toBe(true)
  })

  it('rejects v3', () => {
    expect(isSupportedVersion('3.4.17')).toBe(false)
  })
})
```

`src/design-system/discover.test.ts`:
```ts
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { discoverCssEntry } from './discover'

const fixture = (name: string): string => join(__dirname, '__fixtures__', name)

describe('discoverCssEntry', () => {
  it('finds the single entry', async () => {
    const root = fixture('standard')
    const found = await discoverCssEntry(root, join(root, 'src', 'App.tsx'))
    expect(found).toBe(join(root, 'src', 'app.css'))
  })

  it('picks the entry nearest the active file in a monorepo', async () => {
    const root = fixture('monorepo')
    const found = await discoverCssEntry(root, join(root, 'apps', 'docs', 'src', 'Page.tsx'))
    expect(found).toBe(join(root, 'apps', 'docs', 'src', 'docs.css'))
  })

  it('returns null when no entry exists', async () => {
    const root = fixture('none')
    expect(await discoverCssEntry(root, join(root, 'src', 'App.tsx'))).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/design-system`
Expected: FAIL — cannot resolve `./version` and `./discover`.

- [ ] **Step 4: Write `src/design-system/version.ts`**

```ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function readTailwindVersion(workspaceRoot: string): Promise<string | null> {
  const path = join(workspaceRoot, 'node_modules', 'tailwindcss', 'package.json')
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
    const version = (parsed as { version?: unknown }).version
    return typeof version === 'string' ? version : null
  } catch {
    return null
  }
}

export function isSupportedVersion(version: string): boolean {
  return version.split('.')[0] === '4'
}
```

- [ ] **Step 5: Write `src/design-system/discover.ts`**

```ts
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'

const IGNORED = new Set(['node_modules', '.git', 'dist', 'out', '.vscode-test'])
const ENTRY_PATTERN = /@import\s+["']tailwindcss["']/

async function findCssFiles(directory: string, found: string[]): Promise<void> {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (IGNORED.has(entry.name)) continue
      await findCssFiles(path, found)
    } else if (entry.name.endsWith('.css')) {
      found.push(path)
    }
  }
}

function sharedPrefixLength(a: string, b: string): number {
  const left = a.split(sep)
  const right = b.split(sep)
  let i = 0
  while (i < left.length && i < right.length && left[i] === right[i]) i++
  return i
}

export async function discoverCssEntry(
  workspaceRoot: string,
  activeFile: string,
): Promise<string | null> {
  const cssFiles: string[] = []
  await findCssFiles(workspaceRoot, cssFiles)

  const entries: string[] = []
  for (const path of cssFiles) {
    try {
      if (ENTRY_PATTERN.test(await readFile(path, 'utf8'))) entries.push(path)
    } catch {
      continue
    }
  }

  if (entries.length === 0) return null

  const activeDirectory = dirname(activeFile)
  return entries.reduce((best, current) =>
    sharedPrefixLength(dirname(current), activeDirectory) >
    sharedPrefixLength(dirname(best), activeDirectory)
      ? current
      : best,
  )
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/design-system`
Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add src/design-system .gitignore
git commit -m "feat: add tailwind version detection and CSS entry discovery"
```

Note: the fixture `node_modules` directories must be committed. If `.gitignore` excludes them, add `!src/design-system/__fixtures__/**/node_modules` to `.gitignore` before committing.

---

### Task 11: Design system loader

**Files:**
- Create: `src/design-system/load.ts`
- Test: `src/design-system/load.integration.test.ts`

**Interfaces:**
- Consumes: `readTailwindVersion`, `isSupportedVersion`, `discoverCssEntry`, `DesignSystemPort`
- Produces:
  - `type LoadResult = { ok: true; ds: DesignSystemPort; entry: string } | { ok: false; reason: 'no-tailwind' | 'wrong-version' | 'no-entry' | 'error'; detail?: string }`
  - `loadDesignSystem(workspaceRoot: string, activeFile: string): Promise<LoadResult>`
  - `clearDesignSystemCache(): void`

Dynamically imports the workspace's `tailwindcss/dist/lib.mjs` and calls `__unstable__loadDesignSystem`, which requires `loadStylesheet` and `loadModule` callbacks wired to the filesystem. Results are cached per entry path; `clearDesignSystemCache` is called by the file watcher in Task 13.

This test is named `.integration.test.ts` so Vitest's default run excludes it — it needs a real Tailwind v4 install. Run it explicitly.

- [ ] **Step 1: Write the failing test**

`src/design-system/load.integration.test.ts`:
```ts
import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { clearDesignSystemCache, loadDesignSystem } from './load'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'twexplain-'))
  await mkdir(join(root, 'src'), { recursive: true })
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await symlink(
    join(process.cwd(), 'node_modules', 'tailwindcss'),
    join(root, 'node_modules', 'tailwindcss'),
    'dir',
  )
  await writeFile(
    join(root, 'src', 'app.css'),
    '@import "tailwindcss";\n@theme { --color-brand-600: #4f46e5; }\n',
  )
  clearDesignSystemCache()
})

describe('loadDesignSystem', () => {
  it('loads a real v4 design system and resolves custom theme values', async () => {
    const result = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.ds.candidatesToCss(['bg-brand-600'])[0]).toContain('--color-brand-600')
    expect(result.ds.resolveThemeValue('--color-brand-600')).toBe('#4f46e5')
    expect(result.ds.candidatesToCss(['nope-999'])[0]).toBeNull()
  })
})
```

This test requires `tailwindcss` v4 in the extension's own `node_modules` as a dev dependency. Install it:

```bash
npm i -D tailwindcss
```

- [ ] **Step 2: Run test to verify it fails**

First add an npm script so integration-style Vitest tests have one canonical command. In
`package.json` scripts:

```json
"test:ds": "vitest run --exclude='' src/design-system/load.integration.test.ts"
```

Run: `npm run test:ds`
Expected: FAIL — cannot resolve `./load`.

- [ ] **Step 3: Write the implementation**

`src/design-system/load.ts`:
```ts
import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve as resolvePath } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { DesignSystemPort } from '../explain/index'
import { discoverCssEntry } from './discover'
import { isSupportedVersion, readTailwindVersion } from './version'

export type LoadResult =
  | { ok: true; ds: DesignSystemPort; entry: string }
  | { ok: false; reason: 'no-tailwind' | 'wrong-version' | 'no-entry' | 'error'; detail?: string }

const cache = new Map<string, LoadResult>()

export function clearDesignSystemCache(): void {
  cache.clear()
}

async function importTailwind(workspaceRoot: string): Promise<{
  __unstable__loadDesignSystem: (
    css: string,
    options: {
      base: string
      loadStylesheet: (id: string, base: string) => Promise<{ base: string; content: string }>
      loadModule: () => Promise<{ module: unknown; base: string }>
    },
  ) => Promise<DesignSystemPort>
}> {
  const lib = join(workspaceRoot, 'node_modules', 'tailwindcss', 'dist', 'lib.mjs')
  return (await import(pathToFileURL(lib).href)) as never
}

export async function loadDesignSystem(
  workspaceRoot: string,
  activeFile: string,
): Promise<LoadResult> {
  const version = await readTailwindVersion(workspaceRoot)
  if (version === null) return { ok: false, reason: 'no-tailwind' }
  if (!isSupportedVersion(version)) {
    return { ok: false, reason: 'wrong-version', detail: version }
  }

  const entry = await discoverCssEntry(workspaceRoot, activeFile)
  if (entry === null) return { ok: false, reason: 'no-entry' }

  const cached = cache.get(entry)
  if (cached !== undefined) return cached

  const result = await buildDesignSystem(workspaceRoot, entry)
  cache.set(entry, result)
  return result
}

async function buildDesignSystem(workspaceRoot: string, entry: string): Promise<LoadResult> {
  try {
    const { __unstable__loadDesignSystem } = await importTailwind(workspaceRoot)
    const css = await readFile(entry, 'utf8')

    const ds = await __unstable__loadDesignSystem(css, {
      base: dirname(entry),
      loadStylesheet: async (id, base) => {
        const path = id === 'tailwindcss'
          ? join(workspaceRoot, 'node_modules', 'tailwindcss', 'index.css')
          : id.startsWith('tailwindcss/')
            ? join(workspaceRoot, 'node_modules', `${id}.css`)
            : isAbsolute(id)
              ? id
              : resolvePath(base, id)
        return { base: dirname(path), content: await readFile(path, 'utf8') }
      },
      loadModule: async () => ({ module: {}, base: dirname(entry) }),
    })

    return { ok: true, ds, entry }
  } catch (error) {
    return {
      ok: false,
      reason: 'error',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ds`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/design-system/load.ts src/design-system/load.integration.test.ts package.json package-lock.json
git commit -m "feat: add design system loader"
```

---

### Task 12: JSX class string detection

**Files:**
- Create: `src/detect/jsx.ts`
- Test: `src/detect/jsx.test.ts`

**Interfaces:**
- Consumes: `ClassStringLocation`, `Candidate` from `src/types.ts`
- Produces: `detectJsx(text: string, offset: number, uri: string): ClassStringLocation | null`

Returns the class string containing `offset`, or `null`. Candidate ranges are absolute document offsets so Milestone 2 can build edits directly from them.

Milestone 1 handles `className="..."` and `class="..."` with plain string literals. Helper calls (`cn`, `cva`) arrive in Milestone 3.

- [ ] **Step 1: Write the failing test**

`src/detect/jsx.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { detectJsx } from './jsx'

const source = '<div className="flex items-center gap-2">x</div>'

describe('detectJsx', () => {
  it('returns null when the cursor is outside a class string', () => {
    expect(detectJsx(source, 2, 'file:///a.tsx')).toBeNull()
  })

  it('finds the class string containing the cursor', () => {
    const found = detectJsx(source, 20, 'file:///a.tsx')
    expect(found?.kind).toBe('jsx')
    expect(found?.candidates.map((c) => c.text)).toEqual([
      'flex',
      'items-center',
      'gap-2',
    ])
  })

  it('reports absolute document offsets for each candidate', () => {
    const found = detectJsx(source, 20, 'file:///a.tsx')
    const first = found?.candidates[0]
    expect(source.slice(first?.range.start, first?.range.end)).toBe('flex')
    const last = found?.candidates[2]
    expect(source.slice(last?.range.start, last?.range.end)).toBe('gap-2')
  })

  it('handles the plain class attribute', () => {
    const html = '<div class="p-4">x</div>'
    expect(detectJsx(html, 13, 'file:///a.tsx')?.candidates.map((c) => c.text)).toEqual(['p-4'])
  })

  it('handles single quotes', () => {
    const single = "<div className='p-4 m-2'>x</div>"
    expect(detectJsx(single, 18, 'file:///a.tsx')?.candidates).toHaveLength(2)
  })

  it('collapses runs of whitespace without emitting empty candidates', () => {
    const messy = '<div className="flex   gap-2">x</div>'
    expect(detectJsx(messy, 20, 'file:///a.tsx')?.candidates.map((c) => c.text)).toEqual([
      'flex',
      'gap-2',
    ])
  })

  it('finds the correct string when several are present', () => {
    const two = '<a className="p-1"/><b className="m-2"/>'
    expect(detectJsx(two, 35, 'file:///a.tsx')?.candidates[0]?.text).toBe('m-2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/detect/jsx.test.ts`
Expected: FAIL — cannot resolve `./jsx`.

- [ ] **Step 3: Write the implementation**

`src/detect/jsx.ts`:
```ts
import type { Candidate, ClassStringLocation } from '../types'

const ATTRIBUTE_PATTERN = /\b(?:className|class)\s*=\s*(["'])((?:(?!\1).)*)\1/g

function splitCandidates(value: string, valueStart: number): Candidate[] {
  const candidates: Candidate[] = []
  const pattern = /\S+/g
  let match: RegExpExecArray | null
  let index = 0
  while ((match = pattern.exec(value)) !== null) {
    candidates.push({
      text: match[0],
      range: { start: valueStart + match.index, end: valueStart + match.index + match[0].length },
      index,
    })
    index++
  }
  return candidates
}

export function detectJsx(
  text: string,
  offset: number,
  uri: string,
): ClassStringLocation | null {
  ATTRIBUTE_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTRIBUTE_PATTERN.exec(text)) !== null) {
    const value = match[2] as string
    const valueStart = match.index + match[0].length - 1 - value.length
    const valueEnd = valueStart + value.length
    if (offset < valueStart || offset > valueEnd) continue
    return {
      uri,
      kind: 'jsx',
      range: { start: valueStart, end: valueEnd },
      candidates: splitCandidates(value, valueStart),
    }
  }
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/detect/jsx.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/detect/jsx.ts src/detect/jsx.test.ts
git commit -m "feat: add JSX class string detection"
```

---

### Task 13: Extension host wiring

**Files:**
- Modify: `src/extension.ts`
- Create: `src/panel.ts`, `src/state.ts`
- Test: `src/state.test.ts`

**Interfaces:**
- Consumes: `detectJsx`, `loadDesignSystem`, `clearDesignSystemCache`, `explainCandidates`, `PanelState`, `HostMessage`
- Produces:
  - `computeState(input: { text: string; offset: number; uri: string; workspaceRoot: string | null; fsPath: string }): Promise<PanelState>`
  - `registerPanel(context: vscode.ExtensionContext): vscode.Disposable`

`computeState` holds all the decision logic and takes plain data, so it tests without VS Code. `panel.ts` holds only the webview plumbing.

- [ ] **Step 1: Write the failing test**

`src/state.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { computeState } from './state'

const base = {
  text: '<div className="flex">x</div>',
  offset: 17,
  uri: 'file:///a.tsx',
  fsPath: '/a.tsx',
}

describe('computeState', () => {
  it('reports no-selection when the cursor is outside a class string', async () => {
    const state = await computeState({ ...base, offset: 2, workspaceRoot: '/tmp/none' })
    expect(state.status).toBe('no-selection')
  })

  it('reports no-workspace-tailwind when there is no workspace root', async () => {
    const state = await computeState({ ...base, workspaceRoot: null })
    expect(state.status).toBe('no-workspace-tailwind')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state.test.ts`
Expected: FAIL — cannot resolve `./state`.

- [ ] **Step 3: Write `src/state.ts`**

```ts
import { loadDesignSystem } from './design-system/load'
import { detectJsx } from './detect/jsx'
import { explainCandidates } from './explain/index'
import type { PanelState } from './types'

export type StateInput = {
  text: string
  offset: number
  uri: string
  workspaceRoot: string | null
  fsPath: string
}

export async function computeState(input: StateInput): Promise<PanelState> {
  const location = detectJsx(input.text, input.offset, input.uri)
  if (location === null) return { status: 'no-selection' }
  if (input.workspaceRoot === null) return { status: 'no-workspace-tailwind' }

  const loaded = await loadDesignSystem(input.workspaceRoot, input.fsPath)
  if (!loaded.ok) {
    if (loaded.reason === 'no-tailwind') return { status: 'no-workspace-tailwind' }
    if (loaded.reason === 'wrong-version') {
      return { status: 'wrong-version', found: loaded.detail ?? 'unknown' }
    }
    if (loaded.reason === 'no-entry') return { status: 'no-css-entry' }
    return { status: 'load-error', message: loaded.detail ?? 'unknown error' }
  }

  return { status: 'ready', groups: explainCandidates(location.candidates, loaded.ds) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write `src/panel.ts`**

The webview needs a CSP with a nonce, and its script and style URIs rewritten through `asWebviewUri`.

```ts
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
```

- [ ] **Step 6: Rewrite `src/extension.ts`**

```ts
import type * as vscode from 'vscode'
import { registerPanel } from './panel'

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(registerPanel(context))
}

export function deactivate(): void {}
```

- [ ] **Step 7: Update the scaffold test**

`src/extension.test.ts` mocks `vscode`, so extend the mock to cover what `panel.ts` touches at import time:

```ts
import { describe, expect, it, vi } from 'vitest'

vi.mock('vscode', () => ({
  window: {
    registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeTextEditorSelection: vi.fn(() => ({ dispose: vi.fn() })),
    onDidChangeActiveTextEditor: vi.fn(() => ({ dispose: vi.fn() })),
    activeTextEditor: undefined,
  },
  workspace: {
    onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    createFileSystemWatcher: vi.fn(() => ({
      onDidChange: vi.fn(),
      onDidCreate: vi.fn(),
      onDidDelete: vi.fn(),
      dispose: vi.fn(),
    })),
    getWorkspaceFolder: vi.fn(),
  },
  Uri: { joinPath: vi.fn() },
  Disposable: { from: vi.fn(() => ({ dispose: vi.fn() })) },
}))

describe('activate', () => {
  it('registers the panel without throwing', async () => {
    const { activate } = await import('./extension')
    const context = { subscriptions: [], extensionUri: {} }
    expect(() => activate(context as never)).not.toThrow()
    expect(context.subscriptions).toHaveLength(1)
  })
})
```

- [ ] **Step 8: Run the full unit suite**

Run: `npm test`
Expected: PASS, all suites.

- [ ] **Step 9: Commit**

```bash
git add src/extension.ts src/panel.ts src/state.ts src/extension.test.ts src/state.test.ts
git commit -m "feat: wire extension host and panel"
```

---

### Task 14: Webview panel

**Files:**
- Create: `src/webview/index.tsx`, `src/webview/App.tsx`, `src/webview/App.module.css`, `src/webview/ClassRow.tsx`, `src/webview/ClassRow.module.css`
- Modify: `esbuild.js` (remove the placeholder note from Task 1 if present)

**Interfaces:**
- Consumes: `PanelState`, `HostMessage`, `ExplainedClass`, `ExplainGroup` from `src/types.ts`
- Produces: a rendered panel

Colours are authored in `oklch`, and webviews are Chromium, so swatches render the authored value directly with no conversion. The panel displays the authored value rather than a converted hex approximation.

Component tokens map to VS Code theme variables so the panel matches the user's theme.

- [ ] **Step 1: Write `src/webview/App.module.css`**

```css
.panel {
  --tw-fg: var(--vscode-foreground);
  --tw-muted: var(--vscode-descriptionForeground);
  --tw-accent: var(--vscode-textLink-foreground);
  --tw-border: var(--vscode-panel-border);
  --tw-mono: var(--vscode-editor-font-family);

  color: var(--tw-fg);
  font-family: var(--vscode-font-family);
  font-size: 12px;
  padding: 8px;
}

.notice {
  color: var(--tw-muted);
  padding: 12px 4px;
  line-height: 1.5;
}

.group {
  margin-bottom: 12px;
}

.groupName {
  color: var(--tw-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 10px;
  border-bottom: 1px solid var(--tw-border);
  padding-bottom: 2px;
  margin-bottom: 4px;
}
```

- [ ] **Step 2: Write `src/webview/ClassRow.module.css`**

```css
.row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px;
  align-items: baseline;
  padding: 3px 0;
}

.name {
  font-family: var(--tw-mono);
  color: var(--tw-accent);
  white-space: nowrap;
}

.invalid {
  color: var(--vscode-errorForeground);
  text-decoration: line-through;
}

.prose {
  color: var(--tw-fg);
}

.unexplained {
  color: var(--tw-muted);
  font-style: italic;
}

.raw {
  font-family: var(--tw-mono);
  color: var(--tw-muted);
  white-space: pre-wrap;
  margin: 2px 0 0;
}

.swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  border: 1px solid var(--tw-border);
  margin-right: 4px;
  vertical-align: middle;
}
```

- [ ] **Step 3: Write `src/webview/ClassRow.tsx`**

React 19's types removed the global `JSX` namespace, so return types use `ReactElement`
imported from `react` rather than `JSX.Element`.

```tsx
import type { ReactElement } from 'react'
import type { ExplainedClass } from '../types'
import styles from './ClassRow.module.css'

export function ClassRow({ explained }: { explained: ExplainedClass }): ReactElement {
  const { candidate, valid, prose, declarations, swatch } = explained

  return (
    <div className={styles.row}>
      <span className={valid ? styles.name : `${styles.name} ${styles.invalid}`}>
        {candidate.text}
      </span>
      <span>
        {swatch !== null && <span className={styles.swatch} style={{ background: swatch }} />}
        {!valid && <span className={styles.unexplained}>not a known Tailwind class</span>}
        {valid && prose !== null && <span className={styles.prose}>{prose}</span>}
        {valid && prose === null && (
          <>
            <span className={styles.unexplained}>no plain-English entry yet</span>
            <pre className={styles.raw}>
              {declarations.map((d) => `${d.prop}: ${d.value}`).join('\n')}
            </pre>
          </>
        )}
      </span>
    </div>
  )
}
```

- [ ] **Step 4: Write `src/webview/App.tsx`**

```tsx
import { type ReactElement, useEffect, useState } from 'react'
import type { HostMessage, PanelState } from '../types'
import styles from './App.module.css'
import { ClassRow } from './ClassRow'

const NOTICES: Record<string, string> = {
  'no-selection': 'Put your cursor inside a className string to see it explained.',
  'no-workspace-tailwind': 'No Tailwind installed in this workspace.',
  'no-css-entry': 'No CSS file importing "tailwindcss" was found.',
}

export function App({ vscode }: { vscode: { postMessage(m: unknown): void } }): ReactElement {
  const [state, setState] = useState<PanelState>({ status: 'no-selection' })

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostMessage>): void => {
      if (event.data.type === 'state') setState(event.data.state)
    }
    window.addEventListener('message', onMessage)
    vscode.postMessage({ type: 'ready' })
    return () => window.removeEventListener('message', onMessage)
  }, [vscode])

  return (
    <div className={styles.panel}>
      {state.status === 'wrong-version' && (
        <p className={styles.notice}>
          twexplain supports Tailwind v4 only. This workspace has {state.found}.
        </p>
      )}
      {state.status === 'load-error' && (
        <p className={styles.notice}>Could not load the design system: {state.message}</p>
      )}
      {state.status in NOTICES && <p className={styles.notice}>{NOTICES[state.status]}</p>}
      {state.status === 'ready' &&
        state.groups.map((group) => (
          <section className={styles.group} key={group.name}>
            <h2 className={styles.groupName}>{group.name}</h2>
            {group.classes.map((explained) => (
              <ClassRow explained={explained} key={explained.candidate.index} />
            ))}
          </section>
        ))}
    </div>
  )
}
```

- [ ] **Step 5: Write `src/webview/index.tsx`**

```tsx
import { createRoot } from 'react-dom/client'
import { App } from './App'

declare function acquireVsCodeApi(): { postMessage(m: unknown): void }

const vscode = acquireVsCodeApi()
const container = document.getElementById('root')
if (container !== null) createRoot(container).render(<App vscode={vscode} />)
```

- [ ] **Step 6: Build and verify the bundle**

Run: `npm run check-types && npm run build`
Expected: both succeed. `dist/webview.js` and `dist/webview.css` exist — esbuild emits the CSS alongside the JS when `.module.css` files are imported.

- [ ] **Step 7: Commit**

```bash
git add src/webview esbuild.js
git commit -m "feat: add webview panel"
```

---

### Task 15: Integration test and manual verification

**Files:**
- Create: `.vscode-test.mjs`, `src/integration/panel.integration.test.ts`, `src/integration/__fixtures__/workspace/`

**Interfaces:**
- Consumes: the whole extension

Thin by design: proves the wiring, not the explain layer — that is covered by Tasks 3–9.

- [ ] **Step 1: Create the fixture workspace**

```bash
mkdir -p src/integration/__fixtures__/workspace/src
printf '@import "tailwindcss";\n' > src/integration/__fixtures__/workspace/src/app.css
printf '<div className="flex px-4">x</div>\n' > src/integration/__fixtures__/workspace/src/App.tsx
ln -s ../../../../node_modules src/integration/__fixtures__/workspace/node_modules
```

The symlink target is resolved relative to the symlink's own directory
(`src/integration/__fixtures__/workspace/`), so four `..` segments reach the repo root.
Verify before continuing:

```bash
test -d src/integration/__fixtures__/workspace/node_modules/tailwindcss && echo OK
```

Expected: `OK`. The symlink is covered by `.gitignore`'s `node_modules` rule and is not
committed, so it must be recreated after a fresh clone.

- [ ] **Step 2: Write `.vscode-test.mjs`**

```js
import { defineConfig } from '@vscode/test-cli'

export default defineConfig({
  files: 'out/integration/**/*.integration.test.js',
  workspaceFolder: './src/integration/__fixtures__/workspace',
  mocha: { timeout: 30000 },
})
```

- [ ] **Step 3: Add a compile step for integration tests**

Add to `package.json` scripts:

```json
"compile-integration": "tsc -p . --noEmit false --outDir out --module commonjs --moduleResolution node",
"pretest:integration": "npm run compile-integration && npm run build"
```

- [ ] **Step 4: Write the integration test**

`src/integration/panel.integration.test.ts`:
```ts
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
```

- [ ] **Step 5: Run the integration test**

Run: `npm run test:integration`
Expected: PASS. This downloads a VS Code build on first run.

- [ ] **Step 6: Manual verification**

- Press F5 to launch the Extension Development Host.
- Open a real Tailwind v4 project (`/Users/palnes/src/fuck` has 4.1.7).
- Open the Explorer sidebar; the "Tailwind Inspector" view is there.
- Put the cursor inside a `className` string in a `.tsx` file.
- Confirm: classes appear grouped, spacing shows px values, custom theme colours resolve and show a swatch, and any opaque class shows raw CSS with the "no plain-English entry yet" note rather than an invented description.

- [ ] **Step 7: Run the full check**

Run: `npm run check-types && npm run lint && npm test && npm run build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add .vscode-test.mjs src/integration package.json
git commit -m "test: add integration test and fixture workspace"
```

---

### Task 16: Golden-file corpus

**Files:**
- Create: `src/explain/corpus.ts`, `src/explain/golden.integration.test.ts`
- Create on first run: `src/explain/__golden__/corpus.txt`

**Interfaces:**
- Consumes: `explainCandidates`, `loadDesignSystem`
- Produces: `CORPUS: string[]`

Tasks 3–9 test each stage against hand-written fakes. This task tests the assembled
pipeline against a **real** Tailwind v4 design system, snapshotting output for a corpus
spanning all three tiers. Wording regressions then surface as reviewable diffs rather than
silent drift.

Pinned by the `tailwindcss` dev dependency added in Task 11. Bumping it is expected to
produce a golden diff; that diff is the point.

- [ ] **Step 1: Write the corpus**

`src/explain/corpus.ts`. Keep tiers mixed and explicit so a reviewer can see coverage.

```ts
export const CORPUS: string[] = [
  'flex',
  'inline-flex',
  'grid',
  'hidden',
  'absolute',
  'relative',
  'items-center',
  'justify-between',
  'gap-2',
  'gap-px',
  'px-4',
  'py-2',
  'p-0',
  'p-[13px]',
  'm-auto',
  '-mt-2',
  'w-1/2',
  'w-full',
  'h-screen',
  'min-w-0',
  'text-sm',
  'text-2xl',
  'font-bold',
  'leading-tight',
  'tracking-wide',
  'text-center',
  'truncate',
  'antialiased',
  'sr-only',
  'not-sr-only',
  'isolate',
  'bg-blue-600',
  'bg-blue-600/50',
  'text-white',
  'border-red-500',
  'rounded',
  'rounded-md',
  'rounded-full',
  'border',
  'border-2',
  'border-t',
  'divide-y',
  'shadow',
  'shadow-lg',
  'inset-shadow-sm',
  'ring-2',
  'opacity-50',
  'blur-sm',
  'backdrop-blur',
  'transition',
  'animate-spin',
  'transform',
  'space-x-4',
  'space-y-2',
  'hover:bg-blue-700',
  'focus:outline-none',
  'md:w-1/2',
  'lg:flex-row',
  'dark:bg-slate-900',
  'group-hover:opacity-100',
  'nope-999',
  'definitely-not-a-class',
]
```

- [ ] **Step 2: Write the golden test**

`src/explain/golden.integration.test.ts`:
```ts
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { clearDesignSystemCache, loadDesignSystem } from '../design-system/load'
import type { Candidate } from '../types'
import { CORPUS } from './corpus'
import { explainCandidates } from './index'

let root: string

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'twexplain-golden-'))
  await mkdir(join(root, 'src'), { recursive: true })
  await mkdir(join(root, 'node_modules'), { recursive: true })
  await symlink(
    join(process.cwd(), 'node_modules', 'tailwindcss'),
    join(root, 'node_modules', 'tailwindcss'),
    'dir',
  )
  await writeFile(
    join(root, 'src', 'app.css'),
    '@import "tailwindcss";\n@theme { --color-brand-600: #4f46e5; }\n',
  )
  clearDesignSystemCache()
})

describe('explain pipeline golden corpus', () => {
  it('matches the recorded output for the whole corpus', async () => {
    const loaded = await loadDesignSystem(root, join(root, 'src', 'App.tsx'))
    expect(loaded.ok).toBe(true)
    if (!loaded.ok) return

    const candidates: Candidate[] = CORPUS.map((text, index) => ({
      text,
      range: { start: 0, end: text.length },
      index,
    }))

    const groups = explainCandidates(candidates, loaded.ds)
    const byIndex = new Map(
      groups.flatMap((g) => g.classes).map((c) => [c.candidate.index, c]),
    )

    const report = CORPUS.map((text, index) => {
      const explained = byIndex.get(index)
      if (explained === undefined) return `${text}\n  MISSING`
      if (!explained.valid) return `${text}\n  [invalid]`
      const prose = explained.prose ?? '[no prose — raw CSS shown]'
      const declarations = explained.declarations
        .map((d) => `    ${d.prop}: ${d.value}`)
        .join('\n')
      return `${text}\n  group: ${explained.group}\n  prose: ${prose}\n${declarations}`
    }).join('\n\n')

    await expect(report).toMatchFileSnapshot('./__golden__/corpus.txt')
  })
})
```

- [ ] **Step 3: Add an npm script**

`--exclude=''` does **not** override the config's `exclude` — Vitest treats the flag as
additive, so `vitest run --exclude='' <file>` silently falls back to the default suite and
exits 0. That is a false pass, discovered during Task 11. Use a dedicated config instead.

Task 11 already created `vitest.integration.config.ts`. Extend its `include` to cover this
file as well, then add:

```json
"test:golden": "vitest run --config vitest.integration.config.ts src/explain/golden.integration.test.ts"
```

Verify the script genuinely runs the golden test — check the reported test count and file
name in the output, not just the exit code.

- [ ] **Step 4: Generate and review the golden file**

Run: `npm run test:golden`

The first run writes `src/explain/__golden__/corpus.txt` and passes. **Read that file
before committing it** — this is the only point in the plan where the actual prose quality
gets reviewed end to end. Check specifically:

- `px-4` resolves to `16px`, not `calc(var(--spacing) * 4)`.
- `shadow-lg` and `space-x-4` show the curated override, not `--tw-*` noise.
- `sr-only` reads as purpose ("visually hidden…"), not mechanism.
- `nope-999` and `definitely-not-a-class` are `[invalid]`.
- Any class showing `[no prose — raw CSS shown]` is genuinely one you have not curated
  yet, not a bug in `derive`.

Fix `PHRASES` or `OVERRIDES` for anything wrong, re-run, and re-read.

- [ ] **Step 5: Verify the golden file is stable**

Run: `npm run test:golden`
Expected: PASS with no file change.

- [ ] **Step 6: Commit**

```bash
git add src/explain/corpus.ts src/explain/golden.integration.test.ts src/explain/__golden__ package.json
git commit -m "test: add golden-file corpus for the explain pipeline"
```

---

## Milestone 1 complete

Delivered: a working read-only Tailwind inspector for JSX/TSX, resolving against the workspace's own Tailwind v4 design system, that never invents an explanation.

Next plans, each standalone:

- **Milestone 2 — Editing.** `edit/mutate.ts` built on `parseCandidate`/`printCandidate`, steppers, colour picker, variant chips, add/remove, the six write-back rulings from the spec.
- **Milestone 3 — Remaining detectors.** HTML, Vue, Svelte, `@apply`, and helper calls (`cn`, `clsx`, `cva`), all behind the existing `ClassStringLocation` boundary.
- **Milestone 4 — Curation and polish.** Grow `PHRASES` to ~80 properties and `OVERRIDES` from the backlog command, add the sort command using `getClassOrder`.
