# Fixtures

A workspace for exercising the extension by hand. Open the repository root in VS Code — the
extension resolves Tailwind from the repo's own `node_modules`, and picks `fixtures/src/app.css`
as the entry because it is the CSS entry nearest these files. Nothing to install.

`app.css` declares a custom `@theme` and the **class** dark strategy, so the fixtures exercise
custom colours, custom spacing, and the dark variant that compiles to a selector rather than a
media query.

## Files

| File | Exercises |
| --- | --- |
| `Card.tsx` | `className`, a twelve-line wrapped string, stacked variants, arbitrary values, opacity modifiers, lowercase `class` |
| `Expressions.tsx` | Ternaries, template literals with interpolation, and the `clsx` / `cn` / `twMerge` / `cva` / `tv` helpers |
| `edge-cases.tsx` | Invalid classes, child-scoped utilities, internal-variable-only utilities, negated forms, opaque `--tw-*` machinery, colour-only roots, class-strategy dark, `container` |
| `page.html` | `class` attributes, single quotes, a wrapped string, and a `data-class` attribute that must not be mistaken for one |
| `Widget.vue` | `class`, `:class` array and object syntax, `v-bind:class`, `@apply` in `<style>` |
| `Widget.svelte` | `class`, `class={…}`, template literals, `class:name={cond}` directives, `@apply` in `<style>` |
| `utilities.css` | `@apply`, on one line and wrapped over twelve |

## What to check

**Detection.** Put the cursor in any class string above and the panel should populate. Inside
`${extra}` in a template literal it should stay empty rather than offer `${extra}` as a class.
On the condition in Vue's object syntax — `isActive`, not the key — it should also stay empty.

**Honesty.** These are the claims the extension must never get wrong:

- `divide-red-500` in `edge-cases.tsx` describes a colour on the **children**. The swatch is
  marked and its tooltip says where it applies.
- `shadow-none`, `ring-0`, `blur-none` and the rest of `Negated` read as removals — never as the
  positive effect.
- `shadow-brand-500` and `ring-offset-white` show raw CSS and decline to describe themselves,
  because their root carries another meaning.
- `dark:bg-slate-900` records the selector `&:where(.dark, .dark *)`, not a media query, because
  `app.css` sets the class strategy.
- `nope-999` is struck through.

**Editing.** In `Steppable`, the steppers, colour picker, opacity control and variant chips should
each rewrite one class and leave the rest of the string — including its line breaks — untouched.
Every variant chip offered must produce a class that compiles.

**Commands.** `Tailwind Explain: Sort Classes` on `Sortable` should order the classes and keep
`my-widget` at the front. On `Wrapped` in `Card.tsx` it should reorder without unwrapping the
twelve lines. `Tailwind Explain: Show Curation Backlog` should list what you have visited that
still has no prose.

These files are not compiled or type-checked. They exist to be looked at through the panel.
