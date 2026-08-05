# twexplain — Milestone 1 follow-ups

Findings carried out of Milestone 1's implementation and review, triaged at the final
whole-branch review. Nothing here blocks the merged code; everything here is real.

## Outstanding — needs a human

**Manual F5 verification has never been done.** No test on this branch renders the webview.
The integration test calls `computeState` inside a real VS Code host, proving Tailwind
resolution works, but never resolves the panel, renders React, or moves a cursor.

Check: press F5, open a Tailwind v4 project, put the cursor in a `className`.

Watch specifically for the colour swatch. `ClassRow` uses an inline `style` and the webview
CSP has no `'unsafe-inline'`. React applies styles via CSSOM, which CSP does not police, so
it should work — but it is unverified.

## Parked — real, deliberately not fixed

| Item | Ruling |
|---|---|
| `@plugin` detector regex matches the literal text inside a CSS comment or string | Fails safe — produces an honest "unsupported" message, not a crash |
| `animate-spin` lost its prose | Consequence of the override-honesty fix: `animation: spin 1s linear infinite` is not opaque, so the composite override is correctly withheld. Repair is an `animation` phrase plus an `EXACT` entry for `animation: none` — Milestone 4 |
| `animate` and `divide` composite override entries are unreachable | Bare `animate`/`divide` compile to no CSS; `divide-y` parses with root `divide-y`. Dead entries to remove |
| `shadow-inner` reads "drop shadow" | True but imprecise about inset-ness |

## Should fix soon

Ordered by consequence.

1. **`discoverCssEntry` walks the whole workspace on every keystroke.** Version and entry
   discovery run before the cache by design, and the panel recomputes on every debounced
   selection change. Measured 1ms on this repo, **3314ms on a large tree** — seconds of lag
   per keystroke in the monorepo case the spec explicitly targets. The existing `**/*.css`
   watcher is a ready invalidation hook for memoising the entry path.

2. **Nested-rule context is discarded.** `collectDeclarations` flattens through rules and
   at-rules, dropping selectors and conditions, and `isOpaque` does not cover it. Concrete:
   `container` reports five unconditional `max-width` declarations that are really
   media-query-scoped. The spec lists nested selectors as a tier-3 category; nothing
   detects them.

3. **The version-keyed cache cannot pick up an in-place Tailwind upgrade.** Node's ESM
   registry caches by URL and the URL does not change, so a new cache key re-runs
   `__unstable__loadDesignSystem` against the old code. The only honest fix is a reload
   prompt. Do not trust the guarantee the cache key implies.

4. **`ExplainedClass.variants` can hold `null` at runtime.** `[&>*]:flex` yields
   `variants: [{ root: null }]`. `DesignSystemPort` declares `root: string`, which is a lie.
   A live trap for Milestone 2's variant chips.

5. **JSX regex lacks the `s` flag.** A hand-wrapped multi-line `className` — legal JSX — is
   undetectable, and the panel then claims the cursor is not in a class string.

6. **`loadStylesheet` appends `.css` unconditionally.** `@import "tailwindcss/utilities.css"`
   resolves to `utilities.css.css` → ENOENT → whole-load failure.

7. **`ENTRY_PATTERN` misses Tailwind's individual-imports setup.** An entry of
   `@import "tailwindcss/theme.css" layer(theme); …` yields `no-entry`, so the panel reports
   no Tailwind in a workspace that plainly imports it.

8. **`state.test.ts` covers 2 of 6 `computeState` branches.** The untested ones include
   `load-error`, which is the branch users actually hit.

9. **`discoverCssEntry` gaps:** no test proving `IGNORED` directories are pruned (now
   performance-critical per item 1), and symlinked subdirectories are never explored, which
   matters for pnpm and monorepo layouts. The symlink skip is also the current loop
   protection — replace it deliberately, with a visited-inode set.

10. **oxfmt drift.** `.oxfmtrc.json` cut `oxfmt --list-different src` from 39 files to 13.
    The remaining reflow belongs in its own reviewable commit.

## Test coverage assessment

The middle of the pipeline is well protected. Both ends are not.

- **Strong:** `flatten` (16 tests), `derive` (15), `detect/jsx` (13, with exact offset
  boundaries pinned). The golden corpus earned its keep immediately — it caught two real
  pipeline bugs that every fake-based unit test missed.
- **Weakest:** the webview. All three honesty rules are enforced at render time, and until
  the final fix wave nothing could test `.tsx` at all. `ClassRow`'s branches and `App`'s
  states are the product.
- **Structural note:** the plan fixed each task's test set in advance, so reviewers could
  log coverage gaps but not close them. That worked inside module boundaries and failed at
  the seams — nearly every defect found late lived at a seam.

## Later milestones

- **Milestone 2 — editing.** `edit/mutate.ts` on `parseCandidate`/`printCandidate`, steppers,
  colour picker, variant chips, add/remove, and the six write-back rulings in the spec.
  Fix item 4 above first.
- **Milestone 3 — detectors.** HTML, Vue, Svelte, `@apply`, and `cn`/`clsx`/`cva` helper
  calls, all behind the existing `ClassStringLocation` boundary. Fix item 5 first.
- **Milestone 4 — curation.** Grow `PHRASES` toward ~80 properties and `OVERRIDES` from the
  raw-CSS fallback backlog, add the sort command using `getClassOrder`. Every new override
  entry must be verifiably true of its class's real declarations, and its negating, zero and
  colour-only forms must go into the corpus — that omission is what let `shadow-none` ship
  reading "drop shadow".
