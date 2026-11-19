import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractHeadings, linkText, plainText, scan } from '../src/index.js';

const brief = (md: string) => extractHeadings(md).map((h) => [h.level, h.plain, h.slug]);

describe('extractHeadings', () => {
  it('finds ATX headings with optional closing hashes', () => {
    assert.deepEqual(brief('# One\n## Two ##\n### Three ###   \n   #### Indented\n##### Five #not-closing'), [
      [1, 'One', 'one'],
      [2, 'Two', 'two'],
      [3, 'Three', 'three'],
      [4, 'Indented', 'indented'],
      [5, 'Five #not-closing', 'five-not-closing'],
    ]);
  });

  it('ignores lines that are not ATX headings', () => {
    assert.deepEqual(brief('#hashtag\n####### seven\n    # code\n\\# escaped'), []);
  });

  it('accepts empty headings', () => {
    assert.deepEqual(brief('#\n## #'), [
      [1, '', ''],
      [2, '', '-1'],
    ]);
  });

  it('finds setext headings, including multi-line ones', () => {
    assert.deepEqual(brief('Title\n=====\n\nOne\ntwo\n---\n'), [
      [1, 'Title', 'title'],
      [2, 'One two', 'one-two'],
    ]);
  });

  it('does not mistake thematic breaks, lists or tables for setext headings', () => {
    assert.deepEqual(brief('text\n\n---\n- item\n---\n> quote\n---\n| a |\n|---|\n    code\n---'), []);
  });

  it('ignores headings in code fences, comments and front matter', () => {
    const md = [
      '---',
      '# yaml comment',
      '---',
      '```',
      '# a',
      '```',
      '~~~~',
      '~~~',
      '# b',
      '~~~~',
      '```js title="x"',
      '# c',
      '```',
      '<!-- # d -->',
      '<!--',
      '# e',
      '-->',
      '> ```',
      '> # f',
      '> ```',
      '1. ```',
      '   # g',
      '   ```',
      '# real',
    ].join('\n');
    assert.deepEqual(brief(md), [[1, 'real', 'real']]);
  });

  it('treats an inline code span after ``` as text, not a fence', () => {
    assert.deepEqual(brief('```not `a` fence```\n# yes'), [[1, 'yes', 'yes']]);
  });

  it('does not treat a lone --- as front matter when it is not closed', () => {
    assert.deepEqual(brief('---\n# heading'), [[1, 'heading', 'heading']]);
  });

  it('reports 1-based line numbers and omit comments', () => {
    const [a, b] = extractHeadings('\n# A\n\n## B <!-- omit in toc -->');
    assert.equal(a!.line, 2);
    assert.equal(b!.line, 4);
    assert.equal(b!.omit, true);
    assert.equal(b!.plain, 'B');
    assert.equal(extractHeadings('## C <!-- omit from toc -->')[0]!.omit, true);
    assert.equal(extractHeadings('## C <!-- toc:ignore -->')[0]!.omit, true);
    assert.equal(extractHeadings('## C <!-- note -->')[0]!.omit, false);
  });

  it('handles CRLF line endings', () => {
    assert.deepEqual(brief('# A\r\n\r\n```\r\n# x\r\n```\r\nB\r\n---\r\n'), [
      [1, 'A', 'a'],
      [2, 'B', 'b'],
    ]);
  });

  it('finds the markers and their options', () => {
    const s = scan('<!-- toc max-depth=2 -->\n# x\n<!-- /toc -->\n<!-- toc -->');
    assert.deepEqual(s.markers, { start: 0, end: 2, options: 'max-depth=2', endMarker: '<!-- /toc -->' });
    assert.equal(scan('```\n<!-- toc -->\n```').markers, undefined);
    assert.equal(scan('<!-- tocstop -->').markers, undefined);
    assert.equal(scan('<!-- toc:skip -->').markers, undefined);
    assert.equal(scan('<!-- TOC -->').markers?.start, 0);
  });
});

describe('plainText and linkText', () => {
  const cases: [string, string, string][] = [
    ['The `parse()` function', 'The parse() function', 'The `parse()` function'],
    ['``code with ` tick``', 'code with ` tick', '``code with ` tick``'],
    ['`` `x` ``', '`x`', '`` `x` ``'],
    ['[Docs](https://x.y "title") here', 'Docs here', 'Docs here'],
    ['[ref link][1] and [other][]', 'ref link and other', 'ref link and other'],
    ['Wiki [Foo](https://en.wikipedia.org/wiki/Foo_(bar))', 'Wiki Foo', 'Wiki Foo'],
    ['[![badge](b.svg)](https://ci) CI', 'CI', 'CI'],
    ['*a* **b** ***c*** ~~d~~', 'a b c d', '*a* **b** ***c*** ~~d~~'],
    ['_em_ and __strong__ and in_word', 'em and strong and in_word', '_em_ and __strong__ and in_word'],
    ['<kbd>Ctrl</kbd>+<kbd>C</kbd>', 'Ctrl+C', 'Ctrl+C'],
    ['Escaped \\*not em\\* \\_x\\_', 'Escaped *not em* _x_', 'Escaped \\*not em\\* \\_x\\_'],
    ['[Option] values', '[Option] values', '\\[Option\\] values'],
    ['Copy &copy; &#169; &#xA9; &bogus;', 'Copy © © © &bogus;', 'Copy &copy; &#169; &#xA9; &bogus;'],
    ['Unclosed `tick', 'Unclosed `tick', 'Unclosed `tick'],
    ['<https://example.com>', 'https://example.com', 'https://example.com'],
  ];
  for (const [md, plain, link] of cases) {
    it(JSON.stringify(md), () => {
      assert.equal(plainText(md), plain);
      assert.equal(linkText(md), link);
    });
  }
});
