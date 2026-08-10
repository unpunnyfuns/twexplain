# Contributing to Tailwind Explain

## Scripts

| Script | Runs |
| --- | --- |
| `npm run build` | `esbuild.js` — bundles `dist/extension.js` and `dist/webview.js`, builds `dist/webview.css` with Tailwind, and copies the codicon font |
| `npm run watch` | The same bundles in watch mode |
| `npm run package` | A minified, sourcemap-free production build |
| `npm run check-types` | `tsc --noEmit` |
| `npm run lint` | `oxlint src` |
| `npm run format` | `oxfmt src`, configured by `.oxfmtrc.json` |
| `npm test` | Both test projects: `node` (`*.test.ts`) and `browser` (`*.test.tsx`) |
| `npm run test:ds` | Integration tests that load a real Tailwind design system |
| `npm run test:golden` | The golden-file corpus only, from `src/explain/corpus.ts` |
| `npm run test:integration` | The extension host test, in a real VS Code instance via `vscode-test` |
| `npm run vsix` | Builds an installable `.vsix` |
| `npm run test:watch` | The unit suites in watch mode |
| `npm run link-fixture-modules` | Links tailwindcss into the integration fixture workspace |
| `npm run publish:marketplace` | `vsce publish` |

Lint, format and test after changes.

## Styling

The panel is styled with Tailwind, which means the extension is built with the thing it explains
— `src/webview/panel.css` is a file you can open and inspect with the panel itself.

`@theme` maps VS Code's own variables onto Tailwind tokens, so `text-fg`, `border-edge` and
`bg-overlay` follow the user's colour theme rather than hardcoding a palette. Type scale works the
same way: `--text-base` is `var(--vscode-font-size, 13px)` and the smaller steps are `em` with a
px floor, so the panel follows the editor's font size without collapsing to unreadable text on a
scaled-down window.

The entry uses `source(none)` with an explicit `@source`, because automatic detection would
otherwise scan `fixtures/` and compile every class in the test corpus into the panel stylesheet.
Test files are excluded for the same reason.

Tailwind is built by the CLI from `esbuild.js`, and by `@tailwindcss/vite` in the browser test
project. Component tests assert computed styles, so they need the same CSS the panel ships. Note
that Vite plugins declared at the top level of `vitest.config.ts` do **not** reach the individual
projects — the plugin has to be declared inside the browser project or the tests silently run
unstyled.

## Testing

Component tests run in a real Chromium through **Vitest browser mode** (`@vitest/browser` with
the Playwright provider, plus `vitest-browser-react`). jsdom and happy-dom are not used: a
simulated DOM can pass a test the real runtime would fail. The two `projects` in
`vitest.config.ts` exist because browser tests cannot use node built-ins like `fs`, and the
node-side tests need them.

`test:integration` is preceded by `pretest:integration`, which relinks the fixture workspace's
`node_modules` (gitignored, so a fresh clone needs it recreated), compiles the test to `out/`, and
builds the extension.

To regenerate the golden file after an intentional pipeline change:

```
npx vitest run --config vitest.integration.config.ts src/explain/golden.integration.test.ts -u
```

When a test passes on the first run, mutate the code it covers and confirm the test fails. A test
that cannot fail is not protecting anything, and several of this project's guards were only shown
to be load-bearing that way.

## Modules

| Path | Responsibility |
| --- | --- |
| `src/extension.ts` | Activation; registers the panel |
| `src/panel.ts` | Webview plumbing: creation, messaging, refresh scheduling, commands |
| `src/state.ts` | All decision logic — turns an editor position into a `PanelState` |
| `src/types.ts` | Shared types, including `PanelState` and `ExplainedClass` |
| `src/detect/` | Finds the class string and its candidates at a cursor offset |
| `src/design-system/` | Locates Tailwind and the CSS entry, and loads a design system from them |
| `src/css/` | A small CSS parser producing a `CssNode` tree |
| `src/explain/` | The pure explain pipeline |
| `src/backlog.ts` | Collects classes with no prose into a curation report |
| `src/intent.ts` | Turns a webview edit intent into a text edit |
| `src/sort.ts` | Canonical class ordering, via Tailwind's `getClassOrder` |
| `src/search.ts` | The add-class search over `getClassList()` |
| `src/exclusive.ts` | Which variants cannot coexist on one class |
| `src/edit/` | Candidate mutation and write-back |
| `src/webview/` | The React panel, styled with Tailwind |
| `src/webview/panel.css` | The panel's Tailwind entry, mapping VS Code theme variables into `@theme` |

Modules under `src/explain/` and `src/css/` are pure: they never import `vscode`.

Every detector returns the same `ClassStringLocation`, which is the boundary that lets a new
language be added without touching explain, edit or the panel.

## The explain pipeline

`explainCandidates` runs each candidate through these stages:

| Stage | Does |
| --- | --- |
| `strip.ts` | Drops `--tw-*` declarations and `@property` rules from the compiled CSS |
| `selector.ts` | Records the selector a declaration is scoped to, as a CSS nesting marker |
| `flatten.ts` | Substitutes theme variables, evaluates `calc()`, converts `rem` to px |
| `overrides.ts` | Curated prose for utilities whose CSS does not read as meaning |
| `derive.ts` | Mechanical prose from a declaration's property and value |
| `group.ts` | Sorts explained classes into layout, spacing, typography, colour, … |

`flatten.ts` holds the 16px-per-rem assumption, and is the only place that does.

## The honesty rule

The extension never states something untrue. That constraint decides most design questions here,
and it is worth understanding before changing the explain layer.

Prose is all-or-nothing: if any declaration in a class has no phrase, `prose` is `null` for the
whole class and the panel shows raw CSS instead. Half a description is worse than none.

`overrides.ts` distinguishes two cases:

- **Emergent** utilities such as `sr-only`, whose prose describes the whole recipe and holds
  unconditionally.
- **Composite** utilities such as `shadow`, whose prose stands in for `--tw-*` machinery and only
  holds when the declarations really are that machinery. A value that switches the effect off gets
  its own wording rather than the positive prose, which is why `shadow-lg` reads as "drop shadow"
  and `shadow-none` reads as "no drop shadow".

Overrides are keyed on the candidate **root**, and a root can carry more than one meaning. `divide`
is what `divide-{color}` parses to while `divide-y` has its own root, so those two carry different
prose. `ring-offset` sets both a size and a colour, so it carries none — any single sentence would
be false for half the classes sharing it. Check what a root actually covers before adding an entry:
an override on a root shared by two meanings is how a past bug had eleven classes claiming a drop
shadow they did not draw.

Derived prose is withheld when a class with no variants only styles other elements, so a
child-scoped utility can never claim its effect for the element itself.

## Adding to the corpus

`src/explain/corpus.ts` is the list of classes recorded in the golden file. Add a class there when
you fix or change how it is explained, including the negating and colour-only forms of any utility
whose prose is curated — that is what keeps false prose from returning.

`Show Curation Backlog` in a real workspace, or the golden file's own "no plain-English entry"
lines, is the work list for new prose.

## Using the layers directly

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
import { detectClassString } from './src/detect/index'

const text = '<div className="flex px-4">x</div>'
const location = detectClassString({
  text,
  offset: text.indexOf('flex'),
  uri: 'file:///App.tsx',
  languageId: 'typescriptreact',
})
console.log(location?.candidates.map((c) => c.text))
```
