# Tailwind Explain

A side panel that explains and edits the Tailwind class string under the cursor.

Place the cursor inside a class string. The panel lists each class in it, grouped by concern, with
a plain-English description, the condition it applies under, and the CSS it compiles to. Each class
can be edited in place.

Tailwind is loaded from the workspace's own `node_modules`, so the panel resolves against the
project's theme, `@theme` blocks, custom utilities and colours rather than a bundled copy.

## Descriptions

A description is derived from the compiled CSS where the declarations read as meaning, and comes
from a curated table where they do not — `shadow-lg` compiles to `--tw-*` machinery, so its
description is written rather than derived.

Where a description cannot be given, the panel says so and shows the raw CSS instead. This happens
in three cases:

| Case | Shown |
| --- | --- |
| No entry for the utility yet | The declarations, and "no plain-English entry yet" |
| The class sets only `--tw-*` variables | "sets only Tailwind-internal variables" |
| The class carries a variant whose condition cannot be described | The declarations, unqualified prose withheld |

Conditions are stated rather than left implied:

| Class | Description |
| --- | --- |
| `md:w-1/2` | from 768px up — width 50% |
| `hover:bg-red-500` | while hovered — background … |
| `divide-red-500` | the colour of the dividing lines between children |
| `shadow-none` | no drop shadow |

Breakpoint figures come from the project's own `--breakpoint` values. A colour swatch limited to a
condition, or to the element's children, is marked and names the limit.

## Editing

Each control rewrites one candidate's range. The surrounding string, its formatting and its line
breaks are left as they are, and changes go through the editor's own undo — including `Cmd+Z` with
focus in the panel.

| Control | Effect |
| --- | --- |
| Steppers | Raise or lower a numeric value — `p-4` to `p-5` |
| Colour picker | Replace the colour from the project's palette |
| Opacity | Set or clear the `/50` modifier |
| Variant chips | Add or remove `hover:`, `md:`, `dark:` and the rest |
| Arbitrary value | Edit the value inside `p-[13px]` |
| Add class | Search the full class list, including classes the theme generates |
| Remove | Delete the class |

Only variants that compile on their own are offered. Breakpoints are treated as mutually
exclusive, so a class does not accumulate `sm:md:lg:`; a `sm:max-md:` range is left intact. A class
Tailwind cannot compile is not written.

## Commands

| Command | Effect |
| --- | --- |
| Show Curation Backlog | Opens a report of the classes seen so far that have no plain-English description, grouped by candidate root. Hidden unless `twexplain.curationBacklog` is turned on; it exists for contributing descriptions to this extension. |

Sorting is not provided. Tailwind CSS IntelliSense contributes **Sort Selection**, and
`prettier-plugin-tailwindcss` sorts on save.

## Languages

| Language | Detected in |
| --- | --- |
| TypeScript React, JavaScript React | `className` and `class`, `{…}` expressions, template literals |
| HTML | `class` |
| Vue | `class`, `:class` and `v-bind:class`, array and object syntax |
| Svelte | `class`, `class={…}`, `class:name={cond}` directives, `@apply` in `<style>` |
| CSS, PostCSS | `@apply` |

Class strings inside `cva`, `cn`, `clsx`, `classnames`, `cx`, `twMerge`, `tw` and `tv` are detected
at any nesting depth in any of the above.

## Requirements

- Tailwind v4. Earlier versions use a config-driven pipeline and are reported as unsupported.
- A stylesheet importing Tailwind. If none is found, the panel names the import to add.
- A local workspace on disk. Virtual and untrusted workspaces are not supported.

`@plugin` and `@config` are reported as unsupported rather than loaded with the directive's
contents missing.

This extension resolves and edits class strings; Tailwind CSS IntelliSense provides completion and
hovers. They are complementary.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT.
