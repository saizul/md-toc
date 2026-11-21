import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { extractHeadings, isTocUpToDate, renderToc, TocError, toc, updateToc } from '../src/index.js';

const fixtures = new URL('../../test/fixtures/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, fixtures), 'utf8');

describe('fixtures', () => {
  const inputs = readdirSync(fixtures).filter((f) => f.endsWith('.md') && !f.endsWith('.expected.md'));
  assert.ok(inputs.length >= 10);
  for (const input of inputs) {
    it(input, () => {
      const expected = read(input.replace(/\.md$/, '.expected.md'));
      const result = updateToc(read(input));
      assert.equal(result.found, true);
      assert.equal(result.changed, true);
      assert.equal(result.markdown, expected);
      const again = updateToc(expected);
      assert.equal(again.changed, false, 'updating twice changes nothing');
      assert.equal(again.markdown, expected);
    });
  }
});

describe('renderToc', () => {
  const md = '# T\n## A\n### A1\n#### A1a\n## B\n### B1\n';

  it('nests bullets two spaces per level', () => {
    assert.equal(
      toc(md),
      ['- [A](#a)', '  - [A1](#a1)', '    - [A1a](#a1a)', '- [B](#b)', '  - [B1](#b1)'].join('\n'),
    );
  });

  it('respects min and max depth', () => {
    assert.equal(
      toc(md, { minDepth: 1, maxDepth: 2 }),
      ['- [T](#t)', '  - [A](#a)', '  - [B](#b)'].join('\n'),
    );
    assert.equal(toc(md, { minDepth: 3, maxDepth: 3 }), ['- [A1](#a1)', '- [B1](#b1)'].join('\n'));
  });

  it('numbers ordered lists per level and indents under the number', () => {
    const many = `## T\n${Array.from({ length: 10 }, (_, i) => `## S${i + 1}`).join('\n')}\n### Child`;
    const out = toc(many, { ordered: true }).split('\n');
    assert.equal(out[0], '1. [T](#t)');
    assert.equal(out[10], '11. [S10](#s10)');
    assert.equal(out[11], '    1. [Child](#child)');
  });

  it('uses the chosen bullet', () => {
    assert.equal(toc('## A\n### B', { bullet: '*' }), '* [A](#a)\n  * [B](#b)');
    assert.equal(toc('## A', { bullet: '+' }), '+ [A](#a)');
  });

  it('returns an empty string when nothing matches', () => {
    assert.equal(renderToc(extractHeadings('# only a title')), '');
  });

  it('validates options', () => {
    const bad: [object, RegExp][] = [
      [{ minDepth: 0 }, /minDepth must be/],
      [{ maxDepth: 7 }, /maxDepth must be/],
      [{ maxDepth: 2.5 }, /maxDepth must be/],
      [{ minDepth: 4, maxDepth: 3 }, /larger than maxDepth/],
      [{ bullet: '>' }, /bullet must be/],
    ];
    for (const [options, message] of bad) {
      assert.throws(
        () => renderToc([], options),
        (err: unknown) =>
          err instanceof TocError && err.code === 'INVALID_OPTION' && message.test(err.message),
      );
    }
  });
});

describe('updateToc', () => {
  it('returns found: false and the same text without markers', () => {
    const md = '# A\n## B\n';
    assert.deepEqual(
      { ...updateToc(md), headings: undefined },
      { markdown: md, changed: false, found: false, inserted: false, headings: undefined },
    );
    assert.equal(isTocUpToDate(md), false);
  });

  it('inserts markers before the first section with insert: true', () => {
    const md = '# Title\n\nIntro text.\n\n## One\n\n### Deep\n\n## Two\n';
    const out = updateToc(md, { insert: true });
    assert.equal(out.changed, true);
    assert.equal(out.found, true);
    assert.equal(out.inserted, true);
    assert.equal(
      out.markdown,
      '# Title\n\nIntro text.\n\n<!-- toc -->\n\n- [One](#one)\n  - [Deep](#deep)\n- [Two](#two)\n\n<!-- tocstop -->\n\n## One\n\n### Deep\n\n## Two\n',
    );
    // Running it again is a no-op, now that the markers exist.
    assert.deepEqual(
      { ...updateToc(out.markdown, { insert: true }), headings: undefined },
      { markdown: out.markdown, changed: false, found: true, inserted: false, headings: undefined },
    );
  });

  it('insert adds a blank line after a title with no intro and keeps CRLF', () => {
    assert.equal(
      updateToc('# T\r\n## A\r\n', { insert: true }).markdown,
      '# T\r\n\r\n<!-- toc -->\r\n\r\n- [A](#a)\r\n\r\n<!-- tocstop -->\r\n\r\n## A\r\n',
    );
  });

  it('insert uses the first heading when there is no title, and skips setext titles', () => {
    assert.match(updateToc('Intro\n\n## A\n## B\n', { insert: true }).markdown, /^Intro\n\n<!-- toc -->\n/);
    const setext = updateToc('Title\n=====\n\n## A\n', { insert: true }).markdown;
    assert.equal(setext, 'Title\n=====\n\n<!-- toc -->\n\n- [A](#a)\n\n<!-- tocstop -->\n\n## A\n');
  });

  it('insert leaves documents without sections alone and still validates options', () => {
    for (const md of ['', 'just text\n', '# Only a title\n']) {
      const out = updateToc(md, { insert: true });
      assert.equal(out.markdown, md);
      assert.equal(out.inserted, false);
      assert.equal(out.found, false);
    }
    assert.throws(() => updateToc('# T\n## A\n', { insert: true, maxDepth: 9 }), TocError);
  });

  it('insert ignores headings inside code fences and front matter', () => {
    const md = '---\ntitle: x\n---\n# T\n\n```\n## not a heading\n```\n\n## Real\n';
    const out = updateToc(md, { insert: true }).markdown;
    assert.ok(out.includes('```\n\n<!-- toc -->\n\n- [Real](#real)\n\n<!-- tocstop -->\n\n## Real\n'), out);
  });

  it('replaces an outdated TOC and keeps the rest of the file byte for byte', () => {
    const md = 'intro\n<!-- toc -->\n- [Old](#old)\n<!-- tocstop -->\n\n## New\n\ntext\n';
    const out = updateToc(md);
    assert.equal(
      out.markdown,
      'intro\n<!-- toc -->\n\n- [New](#new)\n\n<!-- tocstop -->\n\n## New\n\ntext\n',
    );
    assert.equal(isTocUpToDate(out.markdown), true);
  });

  it('keeps CRLF line endings', () => {
    const md = '<!-- toc -->\r\n<!-- tocstop -->\r\n## A\r\n';
    assert.equal(updateToc(md).markdown, '<!-- toc -->\r\n\r\n- [A](#a)\r\n\r\n<!-- tocstop -->\r\n## A\r\n');
  });

  it('writes an empty block when there are no headings', () => {
    assert.equal(updateToc('<!-- toc -->').markdown, '<!-- toc -->\n\n<!-- tocstop -->');
  });

  it('lets marker options override the caller', () => {
    const md = '<!-- toc bullet=* min-depth=1 ordered=false -->\n<!-- tocstop -->\n# A\n## B';
    assert.match(
      updateToc(md, { ordered: true, bullet: '+' }).markdown,
      /^\* \[A\]\(#a\)\n {2}\* \[B\]\(#b\)$/m,
    );
  });

  it('reports bad marker options with the line number', () => {
    for (const marker of [
      '<!-- toc depth=3 -->',
      '<!-- toc max-depth=x -->',
      '<!-- toc min-depth=5 max-depth=2 -->',
    ]) {
      assert.throws(
        () => updateToc(`text\n${marker}\n<!-- tocstop -->`),
        (err: unknown) => err instanceof TocError && err.line === 2,
        marker,
      );
    }
  });

  it('only leaves out the heading directly above the marker', () => {
    const md = '## Contents\ntext\n<!-- toc -->\n<!-- tocstop -->\n## A';
    assert.match(updateToc(md).markdown, /- \[Contents\]\(#contents\)\n- \[A\]\(#a\)/);
  });

  it('ignores an end marker that comes before the start marker', () => {
    const md = '<!-- tocstop -->\n<!-- toc -->\n## A\n';
    assert.equal(
      updateToc(md).markdown,
      '<!-- tocstop -->\n<!-- toc -->\n\n- [A](#a)\n\n<!-- tocstop -->\n## A\n',
    );
  });
});
