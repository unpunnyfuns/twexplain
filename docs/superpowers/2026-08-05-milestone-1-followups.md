# twexplain — Milestone 1 follow-ups

Findings carried out of Milestone 1's implementation and review, plus everything fixed since
the merge. Nothing here blocks the shipped code.

## Manual verification — done (2026-08-05)

Verified in an extension dev host against `flashtail` (Tailwind 4.3.3):

- Colour swatches **paint**. This settles the open CSP question: `ClassRow` sets `background`
  via an inline `style` while the webview CSP has no `'unsafe-inline'`, and React's CSSOM path
  is not policed by CSP. Confirmed working, not merely reasoned about.
- `px-2` reports **8px**, not `calc(var(--spacing) * 2)` — theme resolution really is running
  against the workspace's own Tailwind.
- `focus:` and `disabled:` classes land under **state**, not with the colours and borders.

```bash
code --extensionDevelopmentPath=/Users/palnes/src/twexplain --new-window <a-tailwind-v4-project>
```

The panel has its own activity-bar icon, titled "Tailwind Inspector".

Still untested automatically: nothing in the suite renders the panel end to end. The
`ClassRow`/`App` component tests cover the rendering rules; the wiring from cursor move to
painted panel rests on this manual check.

## Fixed since merge

**Entry discovery walked the whole workspace on every keystroke.** `discover.ts` now splits
the workspace-scoped walk (`findEntryCandidates`, memoised) from the per-file choice
(`pickNearestEntry`, pure). `clearDesignSystemCache` clears both, so the existing `**/*.css`
watcher invalidates them together. Measured on a ~127-repo tree: 2714ms cold, 0.027ms warm.

**`variants` could hold nullish entries, and truncated others.** Bigger than first recorded:
`root` is *absent* for arbitrary variants, and using it also truncated compound and functional
ones — `group-hover:` reported `group`, `data-[state=open]:` reported `data`. Now derived from
`ds.printVariant(v)`, which handles all five kinds, and reversed so stacked variants read in
source order (`md:hover:flex` → `['md', 'hover']`). `DesignSystemPort` exports a
`ParsedVariant` type with `root` correctly optional.

**Conditions scoping a declaration were discarded.** `Declaration` gained an optional
`context`; `container` now reads `max-width: 640px [@media (width >= 40rem)]` per breakpoint
instead of five bare values.

Two notes worth keeping:

- A first attempt keyed on whether the at-rule sat *inside* or *outside* the class rule. That
  is **version-dependent** — 4.1.7 nests `@media` inside for variant utilities, 4.3.3 hoists
  it outside. The stable question is whether the class's own **variants** explain the
  condition. `isConditional` is exported from `derive.ts`; the veto lives in
  `explainCandidates`, the only place holding both declarations and variants.
- The prose veto is **load-bearing for Milestone 4**. `container` is honest today only because
  `max-width` has no phrase. Add one and the unguarded pipeline emits a flat sentence claiming
  five unconditional max-widths — verified: a two-declaration fake produced `width 100%; width
  50%`.

**Conditional swatches made unqualified claims.** A painted swatch asserts "this is the
colour", so `dark:bg-slate-900` showed a flat near-black chip with nothing saying it only
applies in dark mode. Conditional swatches are now notched with a dashed outline, and every
swatch carries a `title` with its authored value — which also closed the parked accessibility
minor where colour was the sole carrier. The condition prefers `context` and **falls back to
the variant list**; that fallback is what covers class-strategy dark, where no context exists.

**Multi-line class strings were undetectable.** A hand-wrapped `className` is legal JSX, but
the panel told the user to put the cursor in a class string while it already was. The `s` flag
alone would have been a regression — with `.` matching newlines, an unterminated quote (the
normal state while typing) runs to the next quote anywhere in the file, reporting unrelated
tokens as classes. Values spanning more than 8 newlines are rejected; confirmed load-bearing
by mutation.

**`computeState` error branches and directory pruning were untested.** `state.test.ts` covered
2 of 7 branches, omitting `load-error` — the one users actually hit — and nothing proved the
entry walk prunes `node_modules`/`dist`/`out`/`.git`/`.vscode-test`, which became
performance-critical once discovery was memoised. Both now covered, and both verified
discriminating by mutation: removing the pruning turns 2 tests red, collapsing the
`unsupported-plugin` branch turns its test red.

**An in-place Tailwind upgrade silently served the old runtime.** Node's ESM registry caches by
URL, and upgrading does not change `dist/lib.mjs`'s URL — so the version-keyed cache missed,
rebuilt, and got the *old* module back, explaining classes against the previous Tailwind.
`loadDesignSystem` now records the version it actually imported per workspace and returns
`stale-runtime`, which the panel surfaces as a reload prompt. Reverting the version recovers
without a reload. The integration test that asserted the misleading old behaviour was replaced.

**Tailwind's per-layer import setup was unsupported.** `@import "tailwindcss/theme.css"
layer(theme)` and friends are documented, but `ENTRY_PATTERN` required the bare
`@import "tailwindcss"`, so the panel reported "No CSS file importing tailwindcss was found"
in a project that plainly imports it. Even once found, `loadStylesheet` resolved
`tailwindcss/theme.css` to `theme.css.css` → ENOENT → total failure. Both halves fixed; a
negative test pins that `@import "normalize.css"` is still not an entry. Verified end to end
against real Tailwind.

**`className={...}` expression containers were undetectable.** Reported from real use: a
ternary such as `className={isLight ? "bg-white" : "bg-black"}` was invisible, because the
attribute pattern requires a quote directly after `=`. Detection now falls back to scanning
the expression's brace-matched span for the string literal containing the cursor, so each
ternary branch is explained independently and the cursor on the *condition* correctly yields
nothing.

This reaches further than the reported bug: strings inside `cn(...)` / `clsx(...)` calls are
now found too, which was scheduled for Milestone 3. Two scanner guards, both verified
load-bearing by mutation — brace depth (so a string after a nested `}` is still found) and
quote skipping (so a `}` inside a literal like `content-['}']` cannot end the span early).
The span is capped at 2000 characters so an unclosed brace cannot run away.

Not covered: template literals. `` className={`flex ${x}`} `` is skipped deliberately rather
than emitting `${x}` as a class. That needs Milestone 3's AST work.

**A slow first load showed stale copy instead of admitting it was working.** The residual
~2.7s first walk on a huge tree was not merely slow — during it the panel kept showing the
previous state, which on first open is "Put your cursor inside a className string" while the
cursor is already in one. Same false-statement family as the rest.

`refresh` now posts a `loading` state if the computation has not returned within 250ms, and
cancels that notice when it resolves — so nothing flashes in the common fast case. Both halves
verified by mutation: dropping the `clearTimeout` makes the fast-path test flash `loading`.

**Symlinked source directories were never explored.** `Dirent.isDirectory()` is false for a
symlink, so a workspace reaching its CSS through one was told "No CSS file importing tailwindcss
was found". The walk now follows directory symlinks, with `dev:ino` tracking so a cycle cannot
hang it — verified by mutation against a self-referential symlink and against two symlinks to
one real directory.

Inode tracking runs **only after a symlink has been followed**, plus once to seed the root. A
real directory tree cannot contain a cycle, so statting every ordinary directory was pure cost:
doing it unconditionally pushed the cold walk from 2714ms to 3960ms. Restricted, it is 1720ms.
Seeding the root matters — without it, `root/loop -> root` re-walks the whole tree once before
the guard catches the repeat.

## Still open

1. **Selector context is not recorded** — only at-rule conditions are. This matters most for
   class-strategy dark mode, since Tailwind v4 has two strategies that compile differently:

   | strategy | output | recorded |
   |---|---|---|
   | media (default) | `@media (prefers-color-scheme: dark) { … }` | yes |
   | class (`@custom-variant dark (&:where(.dark, .dark *))`) | `.dark\:bg-x:where(.dark, .dark *)` | **no** |

   So in any project with a dark-mode toggle, a `dark:` class looks unconditional to the
   pipeline. The swatch is correct anyway via the variant fallback, but the raw CSS view shows
   a bare declaration. Fixing this also closes the `divide-y` / `space-x` selector cases. Needs
   the escaped class name stripped out of the selector.

2. **First panel open on a very large tree still costs one full walk (~2.7s).** Off the UI
   thread and once per invalidation; the panel now says it is working while it happens. Making
   it genuinely faster would mean an incremental or cached-to-disk index.

## Parked

| Item | Ruling |
|---|---|
| `@plugin` detector regex matches the literal text inside a CSS comment or string | Fails safe — an honest "unsupported" message, not a crash |
| `animate-spin` lost its prose | Consequence of the override-honesty fix: `animation: spin 1s linear infinite` is not opaque, so the composite override is correctly withheld. Repair is an `animation` phrase plus an `EXACT` entry for `animation: none` — Milestone 4 |
| `animate` and `divide` composite override entries are unreachable | Bare `animate`/`divide` compile to no CSS; `divide-y` parses with root `divide-y`. Dead entries to remove |
| `shadow-inner` reads "drop shadow" | True, but imprecise about inset-ness |
| Template literals in `className={...}` are skipped | Emitting `${x}` as a class would be worse; needs Milestone 3's AST work |
| Swatch condition is a native `title`, so hover-only and slow | Showing it without hovering means a layout change (a label beside the swatch) |

## Test coverage assessment

The middle of the pipeline is well protected. Both ends are thinner.

- **Strong:** `flatten`, `derive`, `detect/jsx` (offset boundaries pinned exactly), and the
  golden corpus — which has now caught four real bugs that fake-based unit tests all missed:
  spaced fraction chains, the empty `--tw-` fallback, `container`'s conditional max-widths, and
  the override misfires.
- **Weakest:** nothing renders the panel end to end. Component tests cover the rendering rules;
  the cursor-to-painted-panel path rests on manual checking.
- **Structural note:** the plan fixed each task's test set in advance, so reviewers could log
  coverage gaps but not close them. That worked inside module boundaries and failed at the
  seams — nearly every defect found late lived at a seam.

## Later milestones

- **Milestone 2 — editing.** `edit/mutate.ts` on `parseCandidate`/`printCandidate`, steppers,
  colour picker, variant chips, add/remove, and the six write-back rulings in the spec. The
  variants fix above is a prerequisite: chips read that array directly.
- **Milestone 3 — detectors.** HTML, Vue, Svelte, `@apply`, and `cn`/`clsx`/`cva` helper calls,
  behind the existing `ClassStringLocation` boundary. AST detection supersedes the regex, and
  with it the multi-line newline cap.
- **Milestone 4 — curation.** Grow `PHRASES` toward ~80 properties and `OVERRIDES` from the
  raw-CSS fallback backlog; add the sort command using `getClassOrder`. Every new override
  entry must be verifiably true of its class's real declarations, and its negating, zero and
  colour-only forms must go into the corpus — that omission is what let `shadow-none` ship
  reading "drop shadow".

## Milestone 2 — started

`src/edit/mutate.ts` exists: `setValue`, `stepValue`, `setModifier`, `addVariant`,
`removeVariant`, behind a narrow `EditPort` (`parseCandidate`, `printCandidate`,
`parseVariant`). Deliberately separate from `DesignSystemPort` — explain reads, edit mutates.

**The trap it exists to avoid, found by probing before writing any code:**
`parseCandidate` returns a **shared, cached object**. Parsing `bg-blue-600` twice yields the
same reference, and mutating it in place poisons Tailwind's own cache — verified, after an
in-place edit `candidatesToCss(['bg-blue-600'])` compiled to `var(--color-red-500)`.

So the corruption would not have been confined to editing: it would have made the read-only
explain path describe `bg-blue-600` as red. Every mutation therefore `structuredClone`s first.
Confirmed load-bearing by mutation — removing the clone fails 5 unit tests and both integration
tests, with the integration failure showing one edit leaking into the next
(`bg-blue-700/50` where `bg-blue-600/50` was expected).

Note the unit-test fake deliberately returns a **shared** object too, so the isolation property
is guarded at both levels rather than only against real Tailwind.

`src/edit/writeback.ts` turns an operation on a candidate into a plain `{start, end, newText}`
text edit — no `vscode` import, so it tests as a pure function. `replaceCandidate`,
`removeCandidate`, `addCandidate`.

A property test drives every candidate across six source shapes (both quote styles, `cn(...)`,
a ternary, multi-line, two attributes in one line) and asserts the document is byte-identical
outside the targeted range. That is the spec's "surgical ranges" requirement made checkable
rather than asserted.

Multi-line removal corrected a wrong assumption of mine. Removing `gap-2` from a wrapped class
string deleted the preceding `\n    ` along with it, joining two lines — reformatting, which the
spec's ruling forbids. Removal now inspects the actual separator text: it collapses the one
before the candidate only when that separator contains no newline, otherwise the one after,
otherwise neither. Verified load-bearing by mutation.

Still to build for Milestone 2: wiring the edits to `WorkspaceEdit` in the host, the panel
controls (steppers, colour picker, variant chips, add-class combobox), and the remaining
write-back rulings — session-scoped disable list, the revision-token echo guard,
arbitrary-value text inputs, one undo step per action.
