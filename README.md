# twexplain

A VS Code extension that explains the Tailwind class string under your cursor in a side panel.

Put the cursor inside a `className` string in a `.tsx` or `.jsx` file and the panel lists each
class, grouped by concern, with the CSS it compiles to and a plain-English description where one
exists. The extension never invents a description: a class it cannot honestly describe shows its
raw CSS declarations plus a muted note instead of prose.

## Constraints

- **Tailwind v4 only.** v3 and earlier use a different, config-driven pipeline and are reported as
  an unsupported version rather than guessed at.
- Tailwind is loaded from the **workspace's** `node_modules` at runtime, never bundled, so the panel
  reflects the project's own theme, `@theme` blocks and custom utilities.
- `@plugin` is not supported yet, and is reported as such.

## Scripts

| Script                  | Runs                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| `npm run build`         | `esbuild.js` — bundles `dist/extension.js` and `dist/webview.js`           |
| `npm run watch`         | The same bundles in watch mode                                            |
| `npm run package`       | A minified, sourcemap-free production build                               |
| `npm run check-types`   | `tsc --noEmit`                                                            |
| `npm run lint`          | `oxlint src`                                                              |
| `npm run format`        | `oxfmt src`, configured by `.oxfmtrc.json`                                |
| `npm test`              | Unit tests: everything except `*.integration.test.*`                       |
| `npm run test:ds`       | Integration tests that load a real Tailwind design system                 |
| `npm run test:golden`   | The golden-file corpus only, from `src/explain/corpus.ts`                  |
| `npm run test:integration` | The extension host test, in a real VS Code instance via `vscode-test`   |

`test:integration` is preceded by `pretest:integration`, which relinks the fixture workspace's
`node_modules` (gitignored, so a fresh clone needs it recreated), compiles the test to `out/`, and
builds the extension.

To regenerate the golden file after an intentional pipeline change:

```
npx vitest run --config vitest.integration.config.ts src/explain/golden.integration.test.ts -u
```

## Modules

| Path                | Responsibility                                                             |
| ------------------- | -------------------------------------------------------------------------- |
| `src/extension.ts`  | Activation; registers the panel                                            |
| `src/panel.ts`      | Webview plumbing: creation, messaging, refresh scheduling                   |
| `src/state.ts`      | All decision logic — turns an editor position into a `PanelState`           |
| `src/types.ts`      | Shared types, including `PanelState` and `ExplainedClass`                   |
| `src/detect/`       | Finds the class string and its candidates at a cursor offset                |
| `src/design-system/` | Locates Tailwind and the CSS entry, and loads a design system from them    |
| `src/css/`          | A small CSS parser producing a `CssNode` tree                               |
| `src/explain/`      | The pure explain pipeline                                                   |
| `src/webview/`      | The React panel, styled with CSS Modules                                    |

Modules under `src/explain/` and `src/css/` are pure: they never import `vscode`.

### The explain pipeline

`explainCandidates` runs each candidate through these stages:

| Stage         | Does                                                                        |
| ------------- | --------------------------------------------------------------------------- |
| `strip.ts`    | Drops `--tw-*` declarations and `@property` rules from the compiled CSS      |
| `flatten.ts`  | Substitutes theme variables, evaluates `calc()`, converts `rem` to px        |
| `overrides.ts` | Curated prose for utilities whose CSS does not read as meaning              |
| `derive.ts`   | Mechanical prose from a declaration's property and value                     |
| `group.ts`    | Sorts explained classes into layout, spacing, typography, colour, …          |

`flatten.ts` holds the 16px-per-rem assumption, and is the only place that does.

Prose is all-or-nothing: if any declaration in a class has no phrase, `prose` is `null` for the
whole class and the panel shows raw CSS instead. `overrides.ts` distinguishes two cases — emergent
utilities such as `sr-only`, whose prose describes the whole recipe and always holds, and composite
utilities such as `shadow`, whose prose only holds when the declarations really are opaque `--tw-*`
machinery and the candidate value does not switch the effect off. That is why `shadow-lg` reads as
"drop shadow" and `shadow-none` does not.

## Usage

The explain layer takes a design system port and a list of candidates, and needs no editor:

```ts
import { loadDesignSystem } from './src/design-system/load'
import { explainCandidates } from './src/explain/index'
import type { Candidate } from './src/types'

const loaded = await loadDesignSystem('/path/to/workspace', '/path/to/workspace/src/App.tsx')
if (loaded.ok) {
  const candidates: Candidate[] = ['flex', 'px-4'].map((text, index) => ({
    text,
    range: { start: 0, end: text.length },
    index,
  }))

  for (const group of explainCandidates(candidates, loaded.ds)) {
    for (const explained of group.classes) {
      console.log(group.name, explained.candidate.text, explained.prose)
    }
  }
}
```

Detection is equally standalone:

```ts
import { detectJsx } from './src/detect/jsx'

const text = '<div className="flex px-4">x</div>'
const location = detectJsx(text, text.indexOf('flex'), 'file:///App.tsx')
console.log(location?.candidates.map((c) => c.text))
```

## Adding to the corpus

`src/explain/corpus.ts` is the list of classes recorded in the golden file. Add a class there when
you fix or change how it is explained, including the negating and colour-only forms of any utility
whose prose is curated — that is what keeps false prose from returning.
