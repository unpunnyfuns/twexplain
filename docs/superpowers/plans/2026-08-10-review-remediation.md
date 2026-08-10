# Review remediation plan

Findings from the five-way review on 2026-08-10. Every item below was confirmed by the reviewer
against real Tailwind, a scratch harness, or a mutation that left the suite green. Ordered by what
the defect does to a user, not by effort.

## Tier 1 — corrupts the user's file

| # | Defect | Site |
| --- | --- | --- |
| 1.1 | `removeCandidate` deletes a `${interpolation}` it mistakes for separator whitespace | `edit/writeback.ts:31-40` |
| 1.2 | `STRING_PATTERN` ignores `\'` escapes; candidate ranges land in source code, and replace writes there | `detect/markup.ts:5` |
| 1.3 | Svelte `class:` char class swallows the next `/` or `"`; also fires outside tags | `detect/svelte.ts:7` |
| 1.4 | Row state keyed by candidate index, so a stale arbitrary value is written onto a different class | `webview/App.tsx:163`, `webview/ArbitraryValue.tsx:13` |
| 1.5 | Edits resolved from a stale snapshot and applied with no document-version guard; concurrent edits not serialised | `panel.ts:105-138` |
| 1.6 | An intent carries only an index, so it can apply to a different element than the panel shows | `panel.ts:105`, `intent.ts:79` |

**Approach.** 1.1 collapses a gap only when it is pure inline whitespace. 1.2 replaces the string
regex with the escape-aware scanner `findCallEnd` already implements — extract one shared helper.
1.3 tightens the character class and requires tag position. 1.4 keys rows by candidate text and
makes `ArbitraryValue` resync. 1.5 captures `document.version` before the await and refuses to
write if it moved, and serialises edits. 1.6 sends the class-string range with the intent and
rejects a mismatch.

## Tier 2 — states something untrue

| # | Defect | Site |
| --- | --- | --- |
| 2.1 | An unrecognised variant disables the veto *and* suppresses the condition, so prose is stated unconditionally (`*:p-4`, `[&>svg]:mt-1`, `aria-*`, `data-*`, `has-*`, named groups, every `@custom-variant`) | `explain/index.ts:111`, `explain/variants.ts:88` |
| 2.2 | `align-items` says "centered" for every value; `justify-content` and `align-content` say "distributed" for alignment values | `explain/derive.ts:158,159,237` |
| 2.3 | 63 gradient *position* classes (`from-10%`, `to-90%`) claim to be colours, with no CSS shown to contradict it | `explain/overrides.ts:26-28` |
| 2.4 | Every `transition-*` claims "most properties", including `transition-opacity` | `explain/overrides.ts:65` |
| 2.5 | A stacked min+max breakpoint range drops the max half | `explain/variants.ts:54-74` |
| 2.6 | `first`/`last`/`odd`/`even` read as styling a child rather than the element | `explain/variants.ts:19-23` |
| 2.7 | CSS parser ignores escapes: `content-['}']` yields zero declarations → "sets only internal variables" | `css/parse.ts:12-23` |
| 2.8 | Same cause: `content-['a;b']` fabricates a declaration that is not real CSS | `css/parse.ts:12-23` |
| 2.9 | `remToPx` rewrites `rem` inside strings and `url()` | `explain/flatten.ts:96` |
| 2.10 | `shadow-[inset_…]` described as a drop shadow | `explain/overrides.ts:46` |
| 2.11 | `@config` is silently discarded, so those projects are told their own classes do not exist | `design-system/load.ts:115` |
| 2.12 | `@plugin` in an imported sheet is only reported when loading also throws | `design-system/load.ts:92-126` |

**Approach.** 2.1 is the important one: make `describeVariants` degrade per variant, and veto prose
whenever a variant is present that the description does not account for. The rest are table and
parser corrections, each pinned by a golden-corpus entry.

## Tier 3 — degraded behaviour

| # | Defect | Site |
| --- | --- | --- |
| 3.1 | `sentFingerprint` survives webview re-resolve, so the palette empties permanently | `panel.ts:167,196` |
| 3.2 | Fingerprint is shape-based, so a changed colour value never reaches the webview | `panel.ts:169` |
| 3.3 | A transient load failure is cached for the session | `design-system/load.ts:82` |
| 3.4 | `getClassList()` rebuilt per keystroke, ~60ms of host blocking, no search debounce | `search.ts:21`, `webview/App.tsx:77` |
| 3.5 | Panel keeps working while hidden | `panel.ts:184` |
| 3.6 | Silent no-ops on refused intents; error storm on repeated refresh failures | `panel.ts:22`, `intent.ts:94` |
| 3.7 | `npm run watch` writes no CSS outside a TTY, silently | `esbuild.js:37` |
| 3.8 | Module-level `generation` shared across registrations | `panel.ts:15` |
| 3.9 | Combobox has no arrow-key navigation and an invalid listbox structure | `webview/AddClass.tsx:20-60` |
| 3.10 | `loading` state unmounts the header, destroying an open Add Class input | `webview/App.tsx:105` |
| 3.11 | `undoLastEdit` can open a second copy of the document and steal focus | `panel.ts:148` |

## Tier 4 — tests that protect nothing

Each proven by mutation.

| # | Test | Mutation that left it green |
| --- | --- | --- |
| 4.1 | `webview/icons.test.ts` (7) | `codicon-BROKEN-${name}` — whole suite still green |
| 4.2 | `webview/App.notices.test.tsx:24` (8) | `opacity-0 text-transparent` on every notice |
| 4.3 | `panel.test.ts:259,486` | reversed range + `'MUTANT'` text |
| 4.4 | `webview/App.header.test.tsx:53` | `sticky` → `static` |
| 4.5 | `panel.test.ts:112,234` | deleted the disposal and generation guards |
| 4.6 | `edit/mutate.integration.test.ts:56-69` | `assertCompiles` reduced to `return` |
| 4.7 | `webview/ClassRowLayout.test.tsx:191` | deleted the remove button |
| 4.8 | `explain/index.test.ts:269` | `variants` forced to `[]` |
| 4.9 | `panel.test.ts:430,453` | variants half of the fingerprint dropped |

Coverage gaps, each proven by deleting the production code with the suite staying green: the
cursor-move refresh path and its debounce; the whole `search` branch; watcher-driven cache
invalidation; script-nonce integrity; command ids versus `package.json`.

Wrong beliefs encoded: `load.integration.test.ts:73` claims `@config` works; `plugin.test.ts:17`
assumes Tailwind v4 CSS has `//` line comments, and the rule it protects will eat a real `@plugin`
on a line containing a protocol-relative URL.

## Tier 5 — packaging and manifest

| # | Item |
| --- | --- |
| 5.1 | No `capabilities`; misleading notice on vscode.dev |
| 5.2 | `react`/`react-dom` are runtime dependencies but are bundled |
| 5.3 | `dist/` never cleaned, stale maps survive |
| 5.4 | Commands lack `enablement`, appear and no-op in unrelated files |
| 5.5 | `localResourceRoots` defaults to every workspace folder |
| 5.6 | `onLanguage:tailwindcss` missing; note vsce derives Marketplace tags from these events |
| 5.7 | Follow-ups doc still calls the panel "Tailwind Inspector" |

## Order of execution

Tier 1, then 2, then 4 (the suite's green light is currently worth less than it looks), then 3,
then 5. Within each tier, group by file so one change closes several findings: the escape-aware
scanner covers 1.2, 2.7 and 2.8; the variant work covers 2.1, 2.5 and 2.6.

Every fix is test-first, and any test that passes on the first run is mutation-checked before it
is believed.
