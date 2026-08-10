# Changelog

All notable changes to Tailwind Explain are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[semantic versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-08-10

First public release.

### Added

- **Class inspector panel.** Put the cursor in a class string and the panel lists every class,
  grouped by concern, with the CSS it compiles to and a plain-English description.
- **Resolution against your own project.** Tailwind is loaded from the workspace's
  `node_modules`, so the panel reflects your theme, `@theme` blocks and custom utilities rather
  than a bundled copy.
- **Editing in place.** Steppers for numeric values, a colour picker drawn from your palette, an
  opacity control, variant chips, an add-class combobox searching the full class list, and
  remove. Every edit rewrites only that candidate's range, never the surrounding string.
- **Detection across languages.** JSX and TSX attributes, expressions and template literals;
  HTML; Vue `class`, `:class` and `v-bind:class`; Svelte attributes and `class:` directives;
  CSS `@apply`; and helper calls — `cva`, `cn`, `clsx`, `classnames`, `cx`, `twMerge`, `tw`, `tv`
  — at any nesting depth.
- **Show Curation Backlog** command, listing every class seen that had no plain-English
  description, grouped by the root an override entry is keyed on. Off by default, behind
  `twexplain.curationBacklog`.
- **Conditions are stated, not implied.** A variant-qualified class says when it applies —
  `md:w-1/2` reads "from 768px up — width 50%" — with breakpoints read from your own
  `--breakpoint` values rather than a fixed scale.
- **Breakpoints are mutually exclusive** when adding a variant, so a class cannot end up as
  `sm:md:lg:rounded`. A genuine `sm:max-md:` range is left alone.
- Sorting is deliberately not provided; Tailwind CSS IntelliSense already contributes
  **Sort Selection**.
- Keyboard navigation in the add-class list, with arrow keys and `aria-activedescendant`.
- `Cmd+Z` / `Ctrl+Z` works with focus in the panel, where the webview would otherwise swallow it.

### Notes

- Tailwind v4 only. v3 is reported as an unsupported version rather than guessed at.
- `@plugin` and `@config` are not supported yet, and are reported rather than silently
  producing a design system that is missing whatever they define.
- The extension never invents a description. A class it cannot honestly describe shows its raw
  CSS declarations and says it has no plain-English entry, and a declaration limited to a
  media query or a selector says what it is limited to, and prose is withheld entirely when a
  class carries a variant whose condition cannot be described.
