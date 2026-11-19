# Security policy

## Supported versions

Only the latest release receives fixes.

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's
private vulnerability reporting ("Report a vulnerability" under the
repository's **Security** tab). You will get an answer within a week.

## Scope

md-toc reads Markdown from pull requests in CI and writes files in place.
Reports in these areas are especially welcome:

- **Writing outside the given files.** md-toc only writes files it was
  given or that a glob matched. Any way to make it write elsewhere (through
  file names, symlinks or marker options) is a bug.
- **Command injection in the GitHub Action.** Inputs reach the shell only
  through environment variables. If an input value or a file name can run
  a command, please report it.
- **Denial of service.** Markdown that makes md-toc take far longer than
  its size suggests (for example a regular expression that backtracks
  badly).
- **Output injection.** File names are printed; control characters are
  replaced so they cannot drive the terminal.

## What md-toc is not

It does not sanitize Markdown. Heading text is copied into the TOC as link
text, so the TOC is exactly as safe as the headings it was made from.
