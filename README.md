# twexplain

**Read and edit long Tailwind class strings without leaving the file.**

Put your cursor in a class string. The side panel lists every class in it, grouped by concern,
each with a plain-English description and the CSS it actually compiles to — and lets you change
any of them in place.

Tailwind is loaded from your own `node_modules`, so everything you see is your project: your
theme, your `@theme` blocks, your custom utilities, your colours.

## It tells you the truth or nothing

A tool that guesses is worse than no tool. twexplain never invents a description.

- A class it cannot honestly describe shows its raw CSS and says it has no plain-English entry —
  it does not improvise one.
- A declaration that only applies inside a media query or under a selector says so. `divide-red-500`
  is described as a colour on the children, not on the element, because that is where it lands.
- `shadow-none` reads as *no drop shadow*, never as *drop shadow*.
- A colour swatch that only applies in dark mode, or only to children, is marked and says why.

## Edit in place

Every control rewrites only the one class you touched. The rest of the string, its formatting and
its line wrapping are untouched, and every change goes through the editor's own undo.

| Control | Does |
| --- | --- |
| **Steppers** | Nudge a numeric value — `p-4` to `p-5` |
| **Colour picker** | Swap the colour, from your project's palette |
| **Opacity** | Set or clear the `/50` modifier |
| **Variant chips** | Add or remove `hover:`, `md:`, `dark:` and the rest |
| **Arbitrary value** | Edit the value inside `p-[13px]` |
| **Add class** | Search the whole class list, including what your theme generates |
| **Remove** | Delete the class |

A class Tailwind cannot compile is never written to your file, so no control can leave a broken
class behind.

## Commands

| Command | Does |
| --- | --- |
| **Sort Tailwind Classes** | Reorders the class string the way Tailwind itself generates the stylesheet. Classes it does not recognise keep their place at the front, and a string your formatter wrapped stays wrapped on the same lines. |
| **Show Curation Backlog** | Lists every class you have looked at that had no plain-English description yet. |

## Works with

| Language | Where it looks |
| --- | --- |
| **React** (TSX, JSX) | `className` and `class`, `{…}` expressions, template literals |
| **HTML** | `class` |
| **Vue** | `class`, `:class` and `v-bind:class`, array and object syntax |
| **Svelte** | `class`, `class={…}`, `class:name={cond}` directives |
| **CSS / PostCSS** | `@apply` |

Class strings inside helper calls are found at any depth, in any of the above: `cva`, `cn`,
`clsx`, `classnames`, `cx`, `twMerge`, `tw`, `tv`.

## Requirements

- **Tailwind v4.** v3 and earlier work in a completely different way, and are reported as
  unsupported rather than guessed at.
- **A stylesheet that imports Tailwind.** If there isn't one, the panel tells you which line to add
  and where.

`@plugin` is not supported yet, and says so rather than failing quietly.

twexplain complements Tailwind CSS IntelliSense — it does not replace it. Keep both.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT.
