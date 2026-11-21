import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { expand, globToRegExp } from '../src/cli/glob.js';
import { run } from '../src/cli/run.js';
import { VERSION } from '../src/index.js';

const STALE = '# Doc\n\n<!-- toc -->\n<!-- tocstop -->\n\n## One\n\n## Two\n';
const FRESH =
  '# Doc\n\n<!-- toc -->\n\n- [One](#one)\n- [Two](#two)\n\n<!-- tocstop -->\n\n## One\n\n## Two\n';

let root = '';
const start = process.cwd();

function files(tree: Record<string, string>) {
  process.chdir(start);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  for (const [path, text] of Object.entries(tree)) {
    mkdirSync(join(root, path, '..'), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  process.chdir(root);
}

function cli(args: string[]) {
  let stdout = '';
  let stderr = '';
  const code = run(args, {
    stdout: (t) => {
      stdout += t;
    },
    stderr: (t) => {
      stderr += t;
    },
    readFile: (p) => readFileSync(p, 'utf8'),
    writeFile: (p, t) => writeFileSync(p, t),
    expand,
  });
  return { code, stdout, stderr };
}

const text = (path: string) => readFileSync(join(root, path), 'utf8');

before(() => {
  root = mkdtempSync(join(tmpdir(), 'md-toc-'));
  process.chdir(root);
});

after(() => {
  process.chdir(start);
  rmSync(root, { recursive: true, force: true });
});

describe('cli', () => {
  beforeEach(() => {
    files({
      'README.md': STALE,
      'FRESH.md': FRESH,
      'docs/guide.md': STALE,
      'docs/deep/api.markdown': STALE,
      'docs/notes.txt': STALE,
      'docs/plain.md': '# No markers\n## Here\n',
      'node_modules/pkg/README.md': STALE,
    });
  });

  it('prints help and version', () => {
    assert.match(cli(['--help']).stdout, /Usage: md-toc \[options\] <file\|dir\|glob>/);
    assert.equal(cli(['-v']).stdout, `${VERSION}\n`);
  });

  it('updates files in place', () => {
    const r = cli(['README.md', 'FRESH.md']);
    assert.equal(r.code, 0);
    assert.equal(r.stdout, 'README.md: updated\nFRESH.md: up to date\n');
    assert.equal(text('README.md'), FRESH);
  });

  it('--check exits 1 for stale files and does not write', () => {
    const r = cli(['--check', 'README.md']);
    assert.equal(r.code, 1);
    assert.equal(
      r.stderr,
      'md-toc: README.md: table of contents is out of date\nRun "md-toc README.md" to update it.\n',
    );
    assert.equal(text('README.md'), STALE);
    assert.equal(cli(['-c', 'FRESH.md']).code, 0);
  });

  it('expands directories and globs, skipping node_modules', () => {
    const r = cli(['--check', '-q', 'docs']);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /docs\/deep\/api\.markdown: table of contents is out of date/);
    assert.match(r.stderr, /docs\/guide\.md: table of contents is out of date/);
    assert.match(r.stderr, /update them/);
    assert.equal(r.stdout, '');

    const g = cli(['**/*.md']);
    assert.equal(g.code, 0);
    assert.equal(
      g.stdout,
      [
        'FRESH.md: up to date',
        'README.md: updated',
        'docs/guide.md: updated',
        'docs/plain.md: no <!-- toc --> marker, skipped',
        '',
      ].join('\n'),
    );
    assert.equal(text('node_modules/pkg/README.md'), STALE);
    assert.equal(text('docs/deep/api.markdown'), STALE);
    assert.equal(cli(['-c', 'docs/**/*.{md,markdown}', 'README.md']).code, 1);
  });

  it('fails on files without markers only with --strict', () => {
    assert.equal(cli(['-c', 'docs/plain.md']).code, 0);
    const r = cli(['-c', '--strict', 'docs/plain.md']);
    assert.equal(r.code, 1);
    assert.match(r.stderr, /docs\/plain\.md: no <!-- toc --> marker, skipped/);
  });

  it('--insert adds markers to files without them', () => {
    const c = cli(['--check', '--insert', 'docs/plain.md']);
    assert.equal(c.code, 1);
    assert.equal(
      c.stderr,
      'md-toc: docs/plain.md: has no table of contents\nRun "md-toc --insert docs/plain.md" to update it.\n',
    );
    assert.equal(text('docs/plain.md'), '# No markers\n## Here\n');
    const r = cli(['--insert', 'docs/plain.md', 'README.md']);
    assert.equal(r.code, 0);
    assert.equal(r.stdout, 'docs/plain.md: inserted a table of contents\nREADME.md: updated\n');
    assert.equal(
      text('docs/plain.md'),
      '# No markers\n\n<!-- toc -->\n\n- [Here](#here)\n\n<!-- tocstop -->\n\n## Here\n',
    );
    assert.equal(text('README.md'), FRESH);
    assert.equal(cli(['--check', '--strict', '--insert', 'docs/plain.md']).code, 0);
  });

  it('prints to stdout with --stdout', () => {
    const r = cli(['--stdout', 'README.md', '--max-depth=2', '--ordered']);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /1\. \[One\]\(#one\)\n2\. \[Two\]\(#two\)/);
    assert.equal(text('README.md'), STALE);
  });

  it('passes list options through', () => {
    cli(['README.md', '--bullet', '*', '--min-depth', '1']);
    assert.match(text('README.md'), /<!-- toc -->\n\n\* \[One\]\(#one\)\n\* \[Two\]\(#two\)\n/);
  });

  it('reports bad marker options with the file and line', () => {
    files({ 'bad.md': '# x\n<!-- toc depth=2 -->\n' });
    const r = cli(['bad.md']);
    assert.equal(r.code, 2);
    assert.equal(r.stderr, 'md-toc: bad.md:2: unknown TOC marker option "depth=2"\n');
  });

  it('rejects usage errors with exit code 2', () => {
    const cases: [string[], RegExp][] = [
      [[], /no Markdown files given/],
      [['-'], /stdin is not supported/],
      [['--bogus', 'README.md'], /unknown option "--bogus"/],
      [['--max-depth', '9', 'README.md'], /--max-depth must be a number from 1 to 6/],
      [['--min-depth'], /--min-depth needs a value/],
      [['--min-depth', '4', '--max-depth', '3', 'README.md'], /is larger than/],
      [['--bullet', '>', 'README.md'], /--bullet must be/],
      [['--check', '--stdout', 'README.md'], /cannot be used together/],
      [['missing.md'], /no files match "missing\.md"/],
      [['nothing/**/*.md'], /no files match/],
      [['--stdout', 'docs'], /--stdout needs exactly one file \(got 3\)/],
    ];
    for (const [args, message] of cases) {
      const r = cli(args);
      assert.equal(r.code, 2, args.join(' '));
      assert.match(r.stderr, message, args.join(' '));
    }
  });

  it('treats arguments after -- as files', () => {
    files({ '-odd.md': STALE });
    assert.equal(cli(['--', '-odd.md']).code, 0);
    assert.equal(text('-odd.md'), FRESH);
  });
});

describe('globToRegExp', () => {
  const cases: [string, string[], string[]][] = [
    ['*.md', ['README.md', 'a.md'], ['docs/a.md', 'a.mdx']],
    ['**/*.md', ['a.md', 'docs/a.md', 'docs/x/y/a.md'], ['a.txt']],
    ['docs/**', ['docs/a.md', 'docs/x/y.md'], ['other/a.md']],
    ['docs/**/index.md', ['docs/index.md', 'docs/x/index.md'], ['docs/xindex.md']],
    ['{README,CHANGELOG}.md', ['README.md', 'CHANGELOG.md'], ['LICENSE.md']],
    ['doc?.md', ['doc1.md'], ['doc12.md', 'doc/.md']],
    ['[ab].md', ['a.md', 'b.md'], ['c.md']],
    ['[!ab].md', ['c.md'], ['a.md']],
    ['a+b (1).md', ['a+b (1).md'], ['aab (1).md']],
  ];
  for (const [glob, yes, no] of cases) {
    it(glob, () => {
      const re = globToRegExp(glob);
      for (const p of yes) assert.ok(re.test(p), `${glob} should match ${p}`);
      for (const p of no) assert.ok(!re.test(p), `${glob} should not match ${p}`);
    });
  }
});
