# Contributing

Thanks for helping improve md-toc. Headings whose anchors do not match
GitHub's, Markdown that confuses the heading scanner, new options and
documentation fixes are all welcome. If you are new to open source, start
with one of the [beginner issues](#good-first-issues) below; each is small
and lists the files involved.

<!-- toc -->

- [Reporting a bug](#reporting-a-bug)
- [Development setup](#development-setup)
- [Guidelines](#guidelines)
- [Project layout](#project-layout)
- [Adding a fixture](#adding-a-fixture)
- [Good first issues](#good-first-issues)
- [Pull requests](#pull-requests)

<!-- tocstop -->

## Reporting a bug

Open an issue with:

- the smallest piece of Markdown that shows the problem
- the command or options you used
- what you got, and what you expected. For anchors, the ID GitHub really
  uses is the best evidence: open the file on GitHub, hover the heading and
  copy its link.
- your md-toc and Node versions (`node --version`)

## Development setup

You need Node 20 or newer.

```console
$ git clone https://github.com/saizul/md-toc.git
$ cd md-toc
$ npm ci
$ npm test              # builds ESM + CJS, compiles the tests and runs node:test
$ npm run lint          # biome lint + tsc --noEmit
$ npm run format        # biome format --write
$ npm run format:check  # what CI runs
```

Try the CLI from the build, on this repository's own docs:

```console
$ node dist/esm/cli.js --check README.md CONTRIBUTING.md
```

## Guidelines

- **Zero runtime dependencies.** Development tools go in `devDependencies`.
- **The library must not need Node.** Only `src/cli.ts` and `src/cli/` may
  use Node APIs.
- **GitHub is the reference.** When an anchor or a heading is in doubt,
  check what GitHub renders and link to an example in the pull request.
- **Never change what is outside the markers.** Tests check that updating
  twice changes nothing and that the rest of a file stays byte for byte the
  same.
- **The docs use the tool.** `README.md` and `CONTRIBUTING.md` have TOCs; a
  test fails if they are stale. Run
  `node dist/esm/cli.js README.md CONTRIBUTING.md` after editing headings.
- Every change comes with a test and a line in the `Unreleased` section of
  `CHANGELOG.md`.

## Project layout

```text
src/
  slug.ts          slugify() and Slugger: GitHub anchors
  inline.ts        plainText() and linkText(): code spans, links, HTML
  headings.ts      scan() and extractHeadings(): fences, comments, setext
  toc.ts           renderToc(), updateToc(), marker options
  errors.ts        TocError and codes
  cli.ts, cli/     command-line interface and glob expansion
action.yml         the composite GitHub Action
test/              node:test suites
test/fixtures/     input files and their .expected.md results
examples/          runnable ESM and CommonJS examples
```

## Adding a fixture

Fixtures are the easiest way to report or fix a scanning problem:

1. Add `test/fixtures/<name>.md` with markers and the tricky headings.
2. Run `npm run build`, then
   `node dist/esm/cli.js --stdout test/fixtures/<name>.md > test/fixtures/<name>.expected.md`.
3. Read the expected file carefully and fix it by hand if md-toc got
   something wrong. That is your failing test.
4. `npm test` picks it up automatically.

## Good first issues

These are deliberately small. Each one lists where to start.

1. **`--diff`**: with `--check`, print the old and new TOC lines for each
   stale file. The old block is `lines.slice(markers.start, markers.end + 1)`
   in `src/toc.ts`; print in `src/cli/run.ts`.
2. **`--indent 4`**: some linters want four spaces per nested level. Add an
   `indent` option to `TocOptions` and use it in `renderToc()` for bullets.
3. **`--stdin`**: read Markdown from standard input and print the result,
   for editor integrations. Change `parseArgs()` in `src/cli/run.ts`.
4. **More slug tests**: add headings in a language you know to the table
   in `test/slug.test.ts`, with the anchor GitHub gives them.
5. **A `<details>` fixture**: document how headings inside `<details>` are
   handled with a new file in `test/fixtures/`.
6. **`.md-toc.json` config**: read default options from a file in the
   current directory in `src/cli.ts`, keeping `src/cli/run.ts` testable.
7. **Action output**: add an `outputs.stale-files` value to `action.yml`
   listing the files that failed, for use in later workflow steps.

## Pull requests

Keep them focused: one fix or feature per pull request. Describe what
changed and how you tested it; the template has a short checklist. CI runs
lint, format check and the tests on Node 20 and 22 on Linux, Node 22 on
Windows and macOS, and the GitHub Action itself.
