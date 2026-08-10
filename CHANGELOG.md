# Changelog

All notable changes to twexplain are recorded here. The format follows
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
- **Sort Tailwind Classes** command, ordering a class string the way Tailwind itself generates
  the stylesheet, preserving unknown classes and existing line wrapping.
- **Show Curation Backlog** command, listing every class seen that had no plain-English
  description, grouped by the root an override entry is keyed on.

### Notes

- Tailwind v4 only. v3 is reported as an unsupported version rather than guessed at.
- `@plugin` is not supported yet, and is reported as such.
- The extension never invents a description. A class it cannot honestly describe shows its raw
  CSS declarations and says it has no plain-English entry, and a declaration limited to a
  media query or a selector says what it is limited to.
