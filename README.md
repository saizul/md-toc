# md-toc

[![CI](https://github.com/saizul/md-toc/actions/workflows/ci.yml/badge.svg)](https://github.com/saizul/md-toc/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/saizul/md-toc?sort=semver)](https://github.com/saizul/md-toc/releases)
[![GitHub Packages](https://img.shields.io/badge/npm-%40saizul%2Fmd--toc-blue?logo=npm)](https://github.com/saizul/md-toc/pkgs/npm/md-toc)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)
![TypeScript](https://img.shields.io/badge/types-included-blue)

Keep the table of contents in your README correct, and let CI tell you when
it is not.

- **Exact GitHub anchors.** Links work on GitHub because they are made the
  same way GitHub makes heading IDs: duplicate headings become `usage-1`,
  `usage-2`; Bangla, Hindi, Chinese or Cyrillic text keeps its letters and
  vowel signs; emoji and punctuation are dropped; inline code, links,
  images and HTML are reduced to their text.
- **Reads Markdown properly.** Headings inside fenced code blocks
  (backtick and tilde fences, even nested and in lists), HTML comments and
  front matter are ignored. ATX (`##`) and setext (`---`) headings both work.
- **Updates in place** between `<!-- toc -->` and `<!-- tocstop -->`
  markers, leaving the rest of the file byte for byte unchanged (CRLF
  files stay CRLF).
- **`--check` for CI** exits 1 when a TOC is stale, and a ready-made
  **GitHub Action** runs it for you.
- Depth limits, numbered or bulleted lists, per-file options in the marker,
  many files and globs at once.

Zero runtime dependencies. ESM, CommonJS and type declarations included.

```console
$ md-toc README.md "docs/**/*.md"
README.md: updated
docs/guide.md: up to date
$ md-toc --check README.md
md-toc: README.md: table of contents is out of date
Run "md-toc README.md" to update it.
```

## Contents

<!-- toc max-depth=2 -->

- [Install](#install)
- [Quick start](#quick-start)
- [Markers](#markers)
- [CLI](#cli)
- [GitHub Action](#github-action)
- [API reference](#api-reference)
- [How anchors are made](#how-anchors-are-made)
- [FAQ](#faq)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

<!-- tocstop -->

## Install

The package is published to GitHub Packages as `@saizul/md-toc`. Tell npm
where the `@saizul` scope lives (once per project or in `~/.npmrc`):

```console
$ echo "@saizul:registry=https://npm.pkg.github.com" >> .npmrc
$ npm install --save-dev @saizul/md-toc
```

GitHub Packages needs a token with `read:packages` even for public packages;
see [Authenticating to GitHub Packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry#authenticating-to-github-packages).
For CI on GitHub you do not need to install anything: use the
[GitHub Action](#github-action).

Node 20 or newer. The library itself uses no Node APIs.

## Quick start

1. Put the markers where the TOC should go:

   ```markdown
   # My project

   ## Contents

   <!-- toc -->
   <!-- tocstop -->

   ## Install
   ...
   ```

2. Generate it:

   ```console
   $ npx @saizul/md-toc README.md
   README.md: updated
   ```

   ```markdown
   ## Contents

   <!-- toc -->

   - [Install](#install)
   - [Usage](#usage)
     - [Options](#options)

   <!-- tocstop -->
   ```

3. Keep it fresh: add `"toc": "md-toc README.md"` to your `package.json`
   scripts, and the [GitHub Action](#github-action) (or `md-toc --check`)
   to CI.

From code:

```ts
import { updateToc, slugify } from '@saizul/md-toc';

const { markdown, changed } = updateToc(readme, { maxDepth: 3 });
slugify('🚀 Quick start'); // '-quick-start'
```

## Markers

The TOC is written between a start marker and an end marker, each on a line
of its own:

```markdown
<!-- toc -->
...generated list...
<!-- tocstop -->
```

`<!-- /toc -->` also works as the end marker, and markers are not case
sensitive. If there is a start marker but no end marker, md-toc inserts the
list and a `<!-- tocstop -->` after it. Markers inside code blocks are
ignored, so you can document them (like this README does). Only the first
start marker in a file is used.

Files without a marker are skipped and reported, and do not fail `--check`
unless you pass `--strict`. With `--insert`, md-toc adds the markers (and
the TOC) to such files instead, on their own line right before the first
section: the first heading after the `#` title, or the first heading when
there is no title. That keeps the title, badges and intro paragraph above
the TOC. Files with no headings besides the title are left alone.

The heading directly above the start marker (with only blank lines in
between), such as `## Contents` here, is the TOC's own title and is left
out of the list.

### Options in the marker

Options written in the start marker apply to that file and override the
command line:

```markdown
<!-- toc max-depth=3 ordered -->
```

| Marker option | CLI flag | Default |
| --- | --- | --- |
| `min-depth=N` | `--min-depth N` | `2` (the `#` title is not listed) |
| `max-depth=N` | `--max-depth N` | `6` |
| `ordered` or `ordered=false` | `--ordered` | bullets |
| `bullet=*` (`-`, `*`, `+`) | `--bullet *` | `-` |

### Leaving headings out

Add `<!-- omit in toc -->` (the comment the VS Code "Markdown All in One"
extension uses) or `<!-- toc:skip -->` to a heading:

```markdown
## Sponsors <!-- omit in toc -->
```

The heading still counts for duplicate numbering, because GitHub still
gives it an anchor.

## CLI

```text
Usage: md-toc [options] <file|dir|glob>...

Options:
  -c, --check           do not write; exit 1 if any TOC is missing or stale
      --stdout          print the result instead of writing (one file only)
      --min-depth <N>   smallest heading level to include (default 2)
      --max-depth <N>   largest heading level to include (default 6)
      --ordered         numbered list instead of bullets
      --bullet <char>   bullet for unordered lists: -, * or + (default -)
      --insert          add markers before the first section of files that
                        have none (with --check: fail for those files)
      --strict          also fail when a file has no <!-- toc --> marker
  -q, --quiet           only print problems
  -h, --help            show this help
  -v, --version         show the version
```

Arguments can be files, directories (every `.md` and `.markdown` file
inside) or globs with `*`, `**`, `?`, `[abc]` and `{a,b}`. Quote globs so
the CLI expands them the same way on every shell and OS. `node_modules` and
`.git` are never searched.

| Exit code | Meaning |
| --- | --- |
| 0 | Every TOC is up to date, or was updated |
| 1 | `--check`: a TOC is stale or its end marker is missing; `--strict`: a file has no marker |
| 2 | Usage error, no file matches an argument, unreadable file, or a bad marker option |

As a pre-commit check (with [husky](https://typicode.github.io/husky/) or
plain git hooks):

```console
$ npx @saizul/md-toc --check README.md docs || exit 1
```

## GitHub Action

The repository is also a composite action that runs `md-toc --check`:

```yaml
name: Docs
on: [push, pull_request]
jobs:
  toc:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: saizul/md-toc@v0.1.0
        with:
          files: |
            README.md
            docs/**/*.md
```

| Input | Default | Meaning |
| --- | --- | --- |
| `files` | `README.md` | Files, directories or globs, separated by spaces or new lines |
| `min-depth` | `''` (2) | Smallest heading level |
| `max-depth` | `''` (6) | Largest heading level |
| `ordered` | `'false'` | `'true'` if your TOCs are numbered |
| `bullet` | `''` (`-`) | Bullet character of your TOCs |
| `strict` | `'false'` | `'true'` to fail on files without a marker |
| `node-version` | `'22'` | Node.js version for `actions/setup-node`; `''` uses the runner's Node |

Use the same options you use locally, or put them in the markers so local
runs and CI always agree. The action builds md-toc from source on the
runner, which takes a few seconds and needs no registry token.

## API reference

### `updateToc(markdown, options?)`

Writes the TOC between the markers and returns
`{ markdown, changed, found, inserted, headings }`. `found` is false when
there is no start marker (the text is returned unchanged); `changed` is true
when the TOC was missing or stale. When nothing changed, `markdown` is the
very same string you passed in.

Options (`UpdateOptions`, which extends `TocOptions`): `minDepth` (default
2), `maxDepth` (default 6), `ordered` (default false), `bullet` (`'-'`,
`'*'` or `'+'`), and `insert` (default false): add markers before the first
section when the document has none, as described under [Markers](#markers).
`inserted` is true when that happened.

### `isTocUpToDate(markdown, options?)`

`true` when the document has a marker and its TOC is current.

### `toc(markdown, options?)`

Just the list for a whole document, if you want to place it yourself.

### `extractHeadings(markdown)` and `scan(markdown)`

`extractHeadings` returns every `Heading`:
`{ level, markdown, text, plain, slug, line, omit }`, where `text` is the
link text used in the TOC, `plain` the rendered text the anchor is made
from, `slug` the unique anchor and `line` the 1-based line number. `scan`
also returns the `markers` and the `lines`.

### `renderToc(headings, options?)`

Renders headings (from `extractHeadings`, or your own) as a nested list.
Skipped levels nest by one step only, so a `####` directly under a `##`
does not turn into an indented code block.

### `slugify(text)` and `Slugger`

`slugify` turns plain text into a GitHub anchor without tracking
duplicates. `new Slugger().slug(text)` numbers duplicates the way GitHub
does; `reset()` forgets them.

### `plainText(markdown)` and `linkText(markdown)`

The inline helpers behind `plain` and `text`: `plainText` gives the rendered
text content; `linkText` unwraps links, removes images and HTML and escapes
brackets, keeping code spans and emphasis.

### `parseMarkerOptions(text)`

Parses `min-depth=2 max-depth=3 ordered bullet=*` into `TocOptions`.

### Errors

`TocError` has a `code` and, for problems in a file, a 1-based `line`:

| Code | When |
| --- | --- |
| `INVALID_OPTION` | A depth outside 1-6, `minDepth` > `maxDepth`, or an unknown bullet |
| `INVALID_MARKER` | An unknown option in the start marker |

`VERSION` is the package version.

## How anchors are made

GitHub turns a heading into an ID from its rendered text:

1. Take the text content: `` The `parse()` function `` gives
   `The parse() function`; `[Docs](url)` gives `Docs`; images and HTML tags
   disappear.
2. Lowercase it.
3. Remove every character that is not a letter, a combining mark, a digit,
   `_`, `-` or a space. Emoji, punctuation and symbols go; vowel signs such
   as the `া` in `বাংলা` stay.
4. Replace each space with `-` (so two spaces give `--`).
5. If the anchor is taken, add `-1`, `-2`, ... until it is free.

| Heading | Anchor |
| --- | --- |
| `## Hello, World!` | `#hello-world` |
| `## 🚀 Quick start` | `#-quick-start` |
| `## ইনস্টল ও ব্যবহার` | `#ইনস্টল-ও-ব্যবহার` |
| `## Q&A: what's new?` | `#qa-whats-new` |
| `## v1.2.3` | `#v123` |
| `## snake_case_name` | `#snake_case_name` |
| `## Usage` (the second one) | `#usage-1` |

These rules match the [`github-slugger`](https://github.com/Flet/github-slugger)
package, the reference most Markdown tools use. Characters added to Unicode
after version 13 may differ between tools.

## FAQ

**Why is my `# Title` not in the TOC?**
The default `min-depth` is 2, because the `#` heading is usually the
document title. Use `--min-depth 1` or `<!-- toc min-depth=1 -->`.

**Does it work with GitLab, Bitbucket or a docs site?**
The anchors follow GitHub's rules. GitLab uses the same rules for most
text, but differs for some punctuation and for duplicates. Static site
generators often have their own slug functions; check one link before
relying on it.

**Why does a heading with an emoji get a leading `-`?**
Because GitHub does the same: the emoji is removed but the space after it
becomes a hyphen. The link has to match GitHub's anchor to work.

**Can I keep my own text inside the markers?**
No, everything between the markers is replaced. Put notes above the start
marker.

**What about headings in HTML (`<h2>`) or inside `<details>`?**
HTML headings are not read. Markdown headings inside `<details>` blocks
are listed; remember that GitHub only renders them as headings when there
is a blank line after the HTML tag.

**Can the TOC be updated on commit automatically?**
Yes, run `md-toc` in a pre-commit hook (and `git add` the files), or
run the GitHub Action on pull requests so no stale TOC gets merged.

## Roadmap

Ideas, many of them good first issues:

- A `--diff` flag that prints what `--check` would change (good first issue)
- GitLab-compatible anchors with `--slug gitlab`
- `--indent 4` for linters that want four-space nested lists (good first issue)
- Reading options from a `.md-toc.json` or `package.json` field
- Collapsible TOC (`<details>`) output
- A `--stdin` mode for editor integrations (good first issue)
- Skip headings inside `<details>` blocks that GitHub would not render

## Contributing

Bug reports with a heading whose anchor does not match GitHub's are
especially welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the setup,
the checks CI runs and a list of beginner-friendly issues. Please follow the
[code of conduct](CODE_OF_CONDUCT.md). Security problems: see
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Saizul Amin
