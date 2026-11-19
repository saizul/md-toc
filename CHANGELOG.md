# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-19

### Added

- `updateToc()`, `isTocUpToDate()` and `toc()`: write a table of contents
  between `<!-- toc -->` and `<!-- tocstop -->` (or `<!-- /toc -->`)
  markers, keeping the rest of the file and its line endings unchanged.
- GitHub-compatible anchors with `slugify()` and `Slugger`: duplicates,
  Unicode letters and marks (Bangla, Hindi, CJK, Cyrillic, Arabic), emoji
  and punctuation removal, matching `github-slugger`.
- `extractHeadings()` and `scan()` for ATX and setext headings, ignoring
  fenced code (backticks and tildes, nested, in lists and blockquotes), HTML
  comments and YAML/TOML front matter.
- `plainText()` and `linkText()`: code spans, links, images, HTML, emphasis,
  escapes and entities handled for anchors and link text.
- `renderToc()` with `minDepth`, `maxDepth`, `ordered` and `bullet`, safe
  nesting for skipped levels, and options in the start marker
  (`<!-- toc max-depth=3 ordered -->`).
- `<!-- omit in toc -->` and `<!-- toc:skip -->` to leave headings out; the
  heading right above the marker is treated as the TOC title.
- The `md-toc` CLI with `--check`, `--stdout`, `--strict`, `--quiet`, depth
  and list options, and files, directories and globs.
- A composite GitHub Action (`action.yml`) that runs `md-toc --check`.
- ESM and CommonJS builds with type declarations; no runtime dependencies.

[Unreleased]: https://github.com/saizul/md-toc/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/saizul/md-toc/releases/tag/v0.1.0
