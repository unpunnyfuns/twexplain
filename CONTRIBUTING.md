# Contributing to Tailwind Explain

## Scripts

| Script | Runs |
| --- | --- |
| `npm run build` | The distributable: an installable `.vsix` in `.artifacts/`, compiling for production first |
| `npm run watch` | `compile` in watch mode |
| `npm run compile` | `esbuild.js` — bundles `dist/extension.js` and `dist/webview.js`, builds `dist/webview.css` with Tailwind, and copies the codicon font |
| `npm run compile:prod` | The same, minified and without sourcemaps |
| `npm run check-types` | `tsc --noEmit` |
| `npm run lint` | `oxlint src` |
| `npm run format` | `oxfmt src`, configured by `.oxfmtrc.json` |
| `npm run format:check` | The same, reporting rather than writing |
| `npm test` | Both test projects: `node` (`*.test.ts`) and `browser` (`*.test.tsx`) |
| `npm run test:ds` | Integration tests that load a real Tailwind design system |
| `npm run test:golden` | The golden-file corpus only, from `src/explain/corpus.ts` |
| `npm run test:integration` | The extension host test, in a real VS Code instance via `vscode-test` |
| `npm run test:watch` | The unit suites in watch mode |
| `npm run publish:marketplace` | `vsce publish` |

Lint, format and test after changes.

## Styling

The panel is styled with Tailwind, which means the extension is built with the thing it explains
— `src/webview/panel.css` is a file you can open and inspect with the panel itself.

`@theme` maps VS Code's own variables onto Tailwind tokens, so `text-fg`, `border-edge` and
`bg-overlay` follow the user's colour theme rather than hardcoding a palette. Type scale works the
same way: `--text-base` is `var(--vscode-font-size, 13px)` and the smaller steps are `em` with a
px floor, so the panel follows the editor's font size without collapsing to unreadable text on a
scaled-down window.

The entry uses `source(none)` with an explicit `@source`, because automatic detection would
otherwise scan `fixtures/` and compile every class in the test corpus into the panel stylesheet.
Test files are excluded for the same reason.

Tailwind is built by the CLI from `esbuild.js`, and by `@tailwindcss/vite` in the browser test
project. Component tests assert computed styles, so they need the same CSS the panel ships. Note
that Vite plugins declared at the top level of `vitest.config.ts` do **not** reach the individual
projects — the plugin has to be declared inside the browser project or the tests silently run
unstyled.

## Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull request, as five jobs so a
failure names itself:

| Job | Runs |
| --- | --- |
| Types, lint, format | `check-types`, `lint`, `format:check` |
| Unit tests | `npm test` — both projects, so it installs Chromium for the browser project |
| Against a real Tailwind | `test:ds` |
| In a real VS Code | `test:integration`, under `xvfb-run`, since vscode-test launches a real editor and needs a display |
| Package | `vsce package`, uploading the `.vsix` as an artefact |

Playwright's browser download is cached on the lockfile hash. There is no publishing workflow:
releases are made by hand, so the first one cannot be automated on a misunderstanding, and no
Marketplace token lives in repository secrets.

### Build output

Two ignored directories, easily confused:

| Directory | Is | Ends up in the package |
| --- | --- | --- |
| `dist/` | The built extension — `extension.js` (the `main` entry VS Code loads), the webview bundle, the stylesheet and the codicon font | yes, this *is* the package's contents |
| `.artifacts/` | The packaged `.vsix` itself | no, it is the output of packaging |

`dist/` is rebuilt from scratch on every non-watch build, so stale output cannot survive.

`npm run build` produces the distributable and nothing else is needed to release. `compile` exists
separately because `dist/extension.js` is what VS Code loads from disk: pressing F5 and
`test:integration` need it there unminified and with sourcemaps, so a stack trace from the
extension host is readable. `build` does not depend on it — `vscode:prepublish` runs
`compile:prod` itself.

### Workflow hardening

Every action is pinned to a commit SHA with the version in a trailing comment, because a tag can be
repointed at new code and anything in a workflow runs with the repository's token. `zizmor` audits
the workflows on every push and pull request, and passes at its `pedantic` persona. To run it
locally:

```
uvx zizmor@latest --persona=pedantic .github/workflows
```

Checkouts set `persist-credentials: false`, every job declares `contents: read`, and no job has
write permissions of any kind. When bumping an action, resolve the new SHA rather than moving the
tag:

```
gh api repos/actions/checkout/git/ref/tags/v7.0.1 --jq '.object.sha'
```

### Dependency hygiene

This repo requires **npm 12**, pinned by `packageManager` and enforced by `engines` with
`engine-strict=true` in `.npmrc` — npm 11 fails with `EBADENGINE` rather than silently installing
with weaker protection. `corepack enable npm` picks up the pinned version; CI does the same.

npm 12 blocks a dependency's install scripts by default, through an empty `allow-scripts`
allowlist. Verified rather than assumed — installing a dependency whose `postinstall` writes a file:

| | Dependency `postinstall` | This project's lifecycle scripts |
| --- | --- | --- |
| npm 11 | ran | ran |
| npm 12 | blocked | run |
| npm 12 with `ignore-scripts=true` | blocked | blocked |

That third row is why `ignore-scripts` is *not* set here: it protects nothing npm 12 does not
already protect, and costs the `pre`/`post` hooks. If a dependency ever genuinely needs its build
script, add that one package to `allow-scripts` rather than reaching for
`dangerously-allow-all-scripts`.

`.npmrc` also sets `min-release-age=3`, so a newly published version cannot be installed for three
days — the median takedown of a malicious release is around 14 hours. `min-release-age-exclude`
exists if a package ever needs an exemption.
