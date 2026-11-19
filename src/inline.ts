/**
 * Inline Markdown helpers for heading text: the plain text GitHub uses for
 * the anchor, and a cleaned-up version for the link text in the TOC.
 */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  copy: '©',
  reg: '®',
  trade: '™',
  hellip: '…',
  mdash: '—',
  ndash: '–',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z]+);/g, (match, body: string) => {
    if (body[0] === '#') {
      const cp =
        body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : Number(body.slice(1));
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '�';
    }
    return ENTITIES[body] ?? match;
  });
}

interface Split {
  /** Text with each code span replaced by a placeholder. */
  text: string;
  /** Code spans as written, backticks included. */
  raw: string[];
  /** Code span contents. */
  content: string[];
}

const HOLD = (i: number) => `\u0000${i}\u0000`;

/** Takes code spans out first: nothing inside backticks is Markdown. */
function splitCode(text: string): Split {
  const raw: string[] = [];
  const content: string[] = [];
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === '\\' && i + 1 < text.length) {
      out += text.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch !== '`') {
      out += ch;
      i++;
      continue;
    }
    let n = 0;
    while (text[i + n] === '`') n++;
    const ticks = '`'.repeat(n);
    let close = -1;
    for (let j = text.indexOf(ticks, i + n); j !== -1; j = text.indexOf(ticks, j + 1)) {
      if (text[j - 1] !== '`' && text[j + n] !== '`') {
        close = j;
        break;
      }
    }
    if (close === -1) {
      out += ticks;
      i += n;
      continue;
    }
    let inner = text.slice(i + n, close);
    if (inner.length > 2 && inner.startsWith(' ') && inner.endsWith(' ') && inner.trim() !== '') {
      inner = inner.slice(1, -1);
    }
    out += HOLD(raw.length);
    raw.push(text.slice(i, close + n));
    content.push(inner);
    i = close + n;
  }
  return { text: out, raw, content };
}

const URL_PART = String.raw`\((?:[^()\s]|\([^()]*\))*(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)`;
const IMAGE = new RegExp(String.raw`!\[[^\]]*\](?:${URL_PART}|\[[^\]]*\])`, 'g');
const LINK = new RegExp(String.raw`\[([^\]]*)\](?:${URL_PART}|\[[^\]]*\])`, 'g');
const AUTOLINK = /<((?:https?|ftp|mailto):[^\s<>]*|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)>/g;
const COMMENT = /<!--[\s\S]*?-->/g;
const TAG = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g;

/** Removes images and HTML, and unwraps links, keeping their text. */
function unwrap(text: string): string {
  return text
    .replace(COMMENT, '')
    .replace(IMAGE, '')
    .replace(LINK, '$1')
    .replace(AUTOLINK, '$1')
    .replace(TAG, '');
}

/**
 * The text content of a rendered heading, which is what GitHub slugs:
 * code spans keep their content, links keep their text, images and HTML
 * tags disappear, emphasis markers and backslash escapes are removed.
 */
export function plainText(markdown: string): string {
  const split = splitCode(markdown);
  let text = unwrap(split.text);
  // Emphasis: * and ~ never survive slugging, but _ does, so only drop
  // underscores that open or close emphasis (not those inside snake_case).
  text = text.replace(/(^|[^\p{L}\p{N}_\\])_+(?=[^\s_])/gu, '$1');
  text = text.replace(/([^\s_\\])_+(?=$|[^\p{L}\p{N}_])/gu, '$1');
  text = text.replace(/(?<!\\)[*]+/g, '').replace(/(?<!\\)~~/g, '');
  text = text.replace(/\\([!-/:-@[-`{-~])/g, '$1');
  text = decodeEntities(text);
  return text.replace(/\u0000(\d+)\u0000/g, (_, i: string) => split.content[Number(i)]!).trim();
}

/**
 * The heading as link text for the TOC: links are unwrapped (a link cannot
 * contain a link), images and HTML are removed, unescaped square brackets
 * are escaped, and code spans and emphasis are kept.
 */
export function linkText(markdown: string): string {
  const split = splitCode(markdown);
  const text = unwrap(split.text)
    .replace(/(\\.)|([[\]])/g, (_, escaped: string | undefined, bracket: string | undefined) =>
      escaped ? escaped : `\\${bracket}`,
    )
    .replace(/\s+/g, ' ')
    .trim();
  return text.replace(/\u0000(\d+)\u0000/g, (_, i: string) => split.raw[Number(i)]!);
}
