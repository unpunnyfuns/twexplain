# twexplain — Milestone 1 follow-ups

Findings carried out of Milestone 1's implementation and review, triaged at the final
whole-branch review. Nothing here blocks the merged code; everything here is real.

## Manual verification — DONE (2026-08-05)

Verified in an extension dev host against `flashtail` (Tailwind 4.3.3), cursor inside a
17-class string in `src/components/SlotEditor.tsx`:

- Colour swatches **paint**. This settles the open CSP question: `ClassRow` sets `background`
  via an inline `style` while the webview CSP has no `'unsafe-inline'`, and React's CSSOM
  path is not policed by CSP. Confirmed working, not merely reasoned about.
- `px-2` reports **8px**, not `calc(var(--spacing) * 2)` — theme resolution really is running
  against the workspace's own Tailwind.
- `focus:border-sky-400` and `disabled:opacity-50` land under **state**, not with the
  colours and borders.

Reproduce with:

```bash
code --extensionDevelopmentPath=/Users/palnes/src/twexplain --new-window <a-tailwind-v4-project>
```

The panel is a webview view in the Explorer sidebar, titled "Tailwind Inspector".

Still untested automatically: nothing in the suite renders the panel end to end. The
`ClassRow`/`App` component tests added during the final fix wave cover the rendering rules;
the wiring from cursor move to painted panel rests on this manual check.

## Parked — real, deliberately not fixed

| Item | Ruling |
|---|---|
| `@plugin` detector regex matches the literal text inside a CSS comment or string | Fails safe — produces an honest "unsupported" message, not a crash |
| `animate-spin` lost its prose | Consequence of the override-honesty fix: `animation: spin 1s linear infinite` is not opaque, so the composite override is correctly withheld. Repair is an `animation` phrase plus an `EXACT` entry for `animation: none` — Milestone 4 |
| `animate` and `divide` composite override entries are unreachable | Bare `animate`/`divide` compile to no CSS; `divide-y` parses with root `divide-y`. Dead entries to remove |
| `shadow-inner` reads "drop shadow" | True but imprecise about inset-ness |

## Should fix soon

Ordered by consequence.

1. ~~**`discoverCssEntry` walks the whole workspace on every keystroke.**~~ **FIXED.**
   `discover.ts` now splits the workspace-scoped walk (`findEntryCandidates`, memoised) from
   the per-file choice (`pickNearestEntry`, pure and cheap), and `clearDesignSystemCache`
   clears both caches so the existing `**/*.css` watcher invalidates them together.
   Measured on a ~127-repo tree: cold walk 2714ms, then 0.027ms per subsequent call.

   Residual: the **first** panel open on a very large tree still costs one full walk (~2.7s).
   It is off the UI thread and happens once per invalidation, so it delays the first result
   rather than blocking the editor. Worth a progress indicator if it ever grates.

2. ~~**Nested-rule context is discarded.**~~ **FIXED.** `Declaration` gained an optional
   `context`, `collectDeclarations` accumulates the at-rule conditions scoping each
   declaration, and both the panel and the golden report show them. `container` now reads
   `max-width: 640px [@media (width >= 40rem)]` per breakpoint instead of five bare values.

   Two design notes worth keeping:

   - An earlier attempt distinguished at-rules nested *inside* the class rule from ones
     wrapping it. That is **version-dependent** — Tailwind 4.1.7 nests `@media` inside the
     class rule for variant utilities, 4.3.3 hoists it outside — so it was abandoned. The
     stable question is whether the class's own **variants** explain the condition:
     `container` has none, so its conditions are unexplained and derived prose is withheld;
     `hover:bg-blue-700` has a `hover` chip, so it keeps its prose and merely gains context
     in the raw CSS. `isConditional` is exported from `derive.ts`; the veto lives in
     `explainCandidates` because only it has both the declarations and the variants.
   - The prose veto is **load-bearing for Milestone 4**, not cosmetic. `container` is honest
     today only because `max-width` has no phrase. The moment Milestone 4 adds one, the
     unguarded pipeline would emit "width 100%; max-width 640px; max-width 768px; …" —
     verified: a two-declaration fake produced the literal lie `width 100%; width 50%`.

   Still not covered: nested *selector* context (`:where(.divide-y > :not(:last-child))`)
   is not recorded — only at-rule conditions are. Those utilities are curated, so nothing
   misreports today, but the gap is real.

3. **The version-keyed cache cannot pick up an in-place Tailwind upgrade.** Node's ESM
   registry caches by URL and the URL does not change, so a new cache key re-runs
   `__unstable__loadDesignSystem` against the old code. The only honest fix is a reload
   prompt. Do not trust the guarantee the cache key implies.

4. ~~**`ExplainedClass.variants` can hold `null` at runtime.**~~ **FIXED.** The problem was
   larger than first recorded: `root` is *absent* for arbitrary variants, and using it also
   truncated compound and functional ones — `group-hover:` reported `group`, and
   `data-[state=open]:` reported `data`. `explainCandidates` now derives each entry from
   `ds.printVariant(v)`, which returns canonical text for all five variant kinds, and
   reverses Tailwind's applied order so stacked variants read in source order
   (`md:hover:flex` → `['md', 'hover']`). `DesignSystemPort` gained an exported
   `ParsedVariant` type whose `root` is correctly optional. Verified against real
   Tailwind, not only against a fake.

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
