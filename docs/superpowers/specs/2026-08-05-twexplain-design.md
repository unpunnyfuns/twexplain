# twexplain — Tailwind class inspector for VS Code

## Problem

Tailwind class strings grow long and unreadable. Reading a 20-class string to work out
what an element does is slow, and editing one means hand-editing a space-separated string
with no feedback about what any token resolves to.

The official Tailwind CSS IntelliSense extension shows compiled CSS on hover. That answers
"what CSS is this" but not "what does this element do", and it offers no editing surface.

## Scope

A VS Code extension providing a side panel that explains and edits the Tailwind class
string under the cursor.

- Tailwind **v4 only**. v3 is out of scope.
- Detection across JSX/TSX, HTML, Vue, Svelte, and CSS `@apply`.
- Full editing: toggle, remove, add, value steppers, colour pickers, variant chips.

## Architecture

Two processes separated by a typed `postMessage` protocol.

```
┌─ extension host (Node) ─────────────────────────┐
│  detect/     jsx html vue svelte apply          │
│                → ClassStringLocation             │
│  design-system/  discover · version · load       │
│                → DesignSystem (cached, watched)  │
│  explain/    strip · flatten · derive ·          │
│              overrides · group                   │
│                → ExplainedClass[]                │
│  edit/       mutate                              │
│                → WorkspaceEdit                   │
└──────────────┬──────────────────────────────────┘
               │ postMessage
┌──────────────▼──────────────────────────────────┐
│  webview (React + CSS Modules)                   │
│    App → GroupList → ClassRow                    │
│    SpacingStepper · ColorSwatch                  │
│    VariantChips · AddClassCombobox               │
└──────────────────────────────────────────────────┘
```

### Core boundary

`detect/*` is the only code aware of framework syntax. Everything downstream consumes:

```ts
type ClassStringLocation = {
  uri: string
  range: Range
  kind: 'jsx' | 'html' | 'vue' | 'svelte' | 'apply'
  candidates: { text: string; range: Range; index: number }[]
}
```

Framework-specific edge cases cannot reach the explain or edit layers.

### Data flow

1. Cursor moves → active detector yields a `ClassStringLocation`.
2. Candidates resolved via `candidatesToCss` + `parseCandidate`.
3. Explain pipeline produces `ExplainedClass[]`, grouped.
4. Posted to webview, rendered.
5. User acts → webview posts an intent → host mutates AST → `WorkspaceEdit` → document
   change re-triggers step 1.

## Resolution

Uses the workspace's own Tailwind installation via `__unstable__loadDesignSystem` from
`tailwindcss/dist/lib.mjs`, dynamically imported from workspace `node_modules`.

Verified available on tailwindcss 4.1.7:

| API | Use |
|---|---|
| `candidatesToCss(string[])` | compile candidates; returns `null` for invalid |
| `parseCandidate(string)` | candidate → AST |
| `printCandidate(ast)` | AST → candidate (round-trips exactly) |
| `parseVariant(string)` | variant chips |
| `getClassList()` | 18,938 entries; add-class search |
| `getClassOrder(string[])` | canonical sort |
| `theme.namespace('--color')` | 245 entries incl. custom; colour picker |
| `theme.entries()` | 376 entries; all namespaces |
| `resolveThemeValue(key)` | `--spacing` → `0.25rem` |

`__unstable__loadDesignSystem` requires `loadStylesheet` and `loadModule` callbacks, wired
to workspace filesystem resolution.

### Entry discovery

`design-system/discover.ts` locates the CSS entry containing `@import "tailwindcss"`.

- Standard case: single entry found.
- Monorepo: several found — use the one nearest the active file.
- None found: extension degrades to raw-CSS-only mode with a status-bar notice.

The loaded `DesignSystem` is cached and invalidated on change to the entry file or any
file it `@import`s.

`design-system/version.ts` reads the workspace `tailwindcss` package version before any
load is attempted. A non-v4 major short-circuits to the v3 notice in Error handling.

## Explain layer

`candidatesToCss` returns unresolved CSS: `px-4` compiles to
`padding-inline: calc(var(--spacing) * 4)`, not `1rem`. Resolution to human-readable
values is this layer's job.

### Pipeline

| Stage | Responsibility | Example |
|---|---|---|
| `strip` | remove `@property` blocks and `--tw-*` declarations | `shadow-lg` → just `box-shadow: …` |
| `flatten` | substitute `resolveThemeValue`, evaluate `calc`, format units | `calc(var(--spacing)*4)` → `1rem` → `16px` |
| `derive` | CSS property → English phrase (~80 properties) | `align-items:center` → "children centered on the cross axis" |
| `overrides` | curated entries keyed by candidate `root` | `space-x`, `sr-only`, `shadow`, `ring` |
| `group` | bucket into panel sections | layout · spacing · typography · colour · border · effects · state |

The `strip` stage is mandatory, not an optimisation. Without it, every shadow, ring, and
transform class emits its `--tw-*` internals and `@property` blocks into the explanation.

Stripping `--tw-*` can leave a declaration referencing a now-removed variable — `shadow-lg`
keeps `box-shadow: var(--tw-shadow), …` after its `--tw-shadow` definition is stripped.
This is intentional and is precisely why such classes are tier 3: the stripped output is
not derivable and must come from a curated override. `derive` therefore treats any
declaration still containing an unresolved `--tw-*` reference as tier 3 rather than
attempting prose.

This check classifies *composite* classes automatically — verified against Tailwind 4.1.7,
`shadow-lg` and `space-x-4` are both caught this way with no hand-maintained list.

It does **not** catch the second kind of tier-3 class: those whose declarations are
individually derivable but whose *combined* meaning is emergent. `sr-only` flattens
cleanly to nine ordinary declarations, yet "position absolute, 1px by 1px, clipped"
describes the mechanism rather than the purpose. These require an explicit override keyed
by candidate `root`, independent of the automatic check. The explicit list is short
(`sr-only`, `truncate`, `antialiased`, `isolate`, and similar) and is additive — a missing
entry degrades to mechanical prose, not to an error.

### Three tiers

1. **Derivable** — single flat rule, standard properties. Derived prose. Most of Tailwind.
   `flex` → `display:flex`.
2. **Flatten-then-derivable** — resolves through theme variables. Same path, requires
   theme. `rounded-md` → `var(--radius-md)`.
3. **Opaque** — nested selectors, `--tw-*` composites, or emergent meaning. Curated
   override required. `space-x-4` compiles to a nested
   `:where(& > :not(:last-child))` rule performing arithmetic on `--tw-space-x-reverse`;
   `sr-only` emits nine declarations whose combined meaning is "visually hidden, still
   announced by screen readers".

**Honesty rule:** a tier-3 class with no curated override renders its raw CSS with a muted
"no plain-English entry yet" note. The extension never invents a description. A command
lists all such classes encountered, giving a natural curation backlog.

The override table is keyed on candidate `root`, not full class name. Roughly 40–60 roots
cover the entire opaque tier.

## Editing

Every mutation is `parseCandidate` → mutate AST → `printCandidate` → `WorkspaceEdit`
replacing only that candidate's range. The containing attribute or string is never
rewritten.

| Action | Mutation |
|---|---|
| stepper ±1 | `value.value = String(n ± 1)` |
| colour pick | `value.value = 'blue-700'` |
| opacity | `modifier = { kind: 'named', value: '50' }` |
| variant chip | push/pop `variants[]` via `parseVariant()` |
| remove | delete candidate range, collapse one adjacent space |
| add | insert at position derived from `getClassOrder()` |

### Rulings

1. **Positional identity.** `flex … flex` are distinct candidates. Rows are keyed by index
   within the location, never by class text.
2. **Removal is destructive.** A class inside a string cannot be commented out. Disabled
   classes are held in an in-memory per-location list so they can be restored. This is
   session-scoped and lost on reload; the UI states this rather than implying persistence.
3. **Echo loop.** Panel-originated edits carry a revision token. Re-render on document
   change is debounced 150ms and skips token'd revisions, so the panel never fights typing.
4. **Whitespace.** Removal collapses exactly one adjacent space. No reformatting of the
   surrounding attribute — that is the formatter's responsibility.
5. **Arbitrary values.** `value.kind === 'arbitrary'` renders a text input, not a stepper.
   `p-[13px]` has no scale to walk.
6. **Undo granularity.** One panel action produces one `WorkspaceEdit`, hence one undo
   step. Edits are not batched.

Write-back into `@apply` and `cva()` requires no special handling — the detector has
already reduced both to candidate ranges.

### Spacing and colour specifics

- v4 spacing is multiplicative: `px-4` is `calc(var(--spacing) * 4)`. The stepper
  increments an integer rather than walking a named scale.
- Theme colours are authored in `oklch`. Webviews are Chromium, so swatches render as
  `background: oklch(…)` with no conversion library. The panel displays the authored
  value; it does not show a converted hex approximation.

### Class search

`getClassList()` returns 18,938 entries. The list is not shipped to the webview. The
combobox posts a query to the host, which returns the top ~50 matches.

## Additional command

`getClassOrder` makes canonical class sorting near-free, so a "sort classes" command ships
alongside the panel.

## Testing

Vitest. The layering keeps most testing free of VS Code.

| Target | Approach |
|---|---|
| `detect/*` | table-driven fixtures per framework: source in, expected candidate ranges out |
| `explain/*` | golden files over a ~200-class corpus spanning all three tiers, against a pinned Tailwind version |
| `edit/mutate.ts` | round-trip property test: `print(parse(x)) === x` for the whole corpus, then mutation assertions |
| `design-system/discover.ts` | fixture workspaces: standard entry, monorepo with several, none found |
| integration | `vscode-test`, thin: panel opens, cursor move populates, one toggle yields expected document text |

Golden-file tests pin the Tailwind version so wording regressions surface as diffs.

## Error handling

| Condition | Behaviour |
|---|---|
| No Tailwind in workspace | Panel shows a notice; no explanation offered |
| No CSS entry found | Raw-CSS-only mode, status-bar notice |
| Tailwind v3 detected | Panel states v4-only, does not attempt resolution |
| `candidatesToCss` returns `null` | Class flagged invalid in panel |
| Tier-3 class, no override | Raw CSS shown with "no plain-English entry yet" |
| Design system load throws | Error surfaced in panel, cached failure until entry file changes |

## Milestones

The scope spans five detectors, a resolution layer, an explain pipeline, and a full
editing panel. It is one coherent extension with clean seams, but the implementation plan
should phase it so each milestone is independently usable.

1. **Resolve and explain, read-only, JSX only.** `design-system/*`, `explain/*`, JSX
   detector, panel rendering. Proves the explain layer, which carries the product risk.
2. **Editing.** `edit/mutate.ts`, steppers, colour picker, variant chips, add/remove.
3. **Remaining detectors.** HTML, Vue, Svelte, `@apply`. Each is additive behind the
   `ClassStringLocation` boundary.
4. **Curation and polish.** Override table filled out from the backlog command, sort
   command, error states.

## Stack

- TypeScript, esbuild, `vscode-test` — matching the `azure-refcheck-vscode` setup.
- Webview: React + CSS Modules with custom properties mapped to VS Code theme variables.
- Vitest, oxlint, oxfmt.
- npm.

## Out of scope

- Tailwind v3.
- Persisting disabled classes across reloads.
- Replacing Tailwind CSS IntelliSense — this complements it.
- Hover or inline-decoration surfaces.
