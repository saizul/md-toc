import { TocError } from './errors.js';
import { type Heading, scan } from './headings.js';

export interface TocOptions {
  /** Smallest heading level to include. Default 2 (skips the `#` title). */
  minDepth?: number;
  /** Largest heading level to include. Default 6. */
  maxDepth?: number;
  /** Numbered list instead of bullets. Default false. */
  ordered?: boolean;
  /** Bullet character for unordered lists: `-`, `*` or `+`. Default `-`. */
  bullet?: '-' | '*' | '+';
}

type Resolved = Required<TocOptions>;

const DEFAULTS: Resolved = { minDepth: 2, maxDepth: 6, ordered: false, bullet: '-' };

function resolve(options: TocOptions, line?: number): Resolved {
  const out = { ...DEFAULTS };
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  for (const key of ['minDepth', 'maxDepth'] as const) {
    const v = out[key];
    if (!Number.isInteger(v) || v < 1 || v > 6) {
      throw new TocError(
        'INVALID_OPTION',
        `${key} must be a whole number from 1 to 6 (got ${String(v)})`,
        line,
      );
    }
  }
  if (out.minDepth > out.maxDepth) {
    throw new TocError(
      'INVALID_OPTION',
      `minDepth (${out.minDepth}) is larger than maxDepth (${out.maxDepth})`,
      line,
    );
  }
  if (!['-', '*', '+'].includes(out.bullet)) {
    throw new TocError(
      'INVALID_OPTION',
      `bullet must be "-", "*" or "+" (got ${JSON.stringify(out.bullet)})`,
      line,
    );
  }
  return out;
}

/**
 * Parses options written in the start marker:
 * `<!-- toc min-depth=1 max-depth=3 ordered bullet=* -->`.
 */
export function parseMarkerOptions(text: string, line?: number): TocOptions {
  const options: TocOptions = {};
  for (const token of text.split(/\s+/).filter(Boolean)) {
    const [key, value] = token.split('=', 2) as [string, string | undefined];
    const fail = (): never => {
      throw new TocError('INVALID_MARKER', `unknown TOC marker option "${token}"`, line);
    };
    if ((key === 'min-depth' || key === 'max-depth') && value !== undefined && /^\d+$/.test(value)) {
      options[key === 'min-depth' ? 'minDepth' : 'maxDepth'] = Number(value);
    } else if (key === 'ordered' && (value === undefined || value === 'true' || value === 'false')) {
      options.ordered = value !== 'false';
    } else if (key === 'bullet' && (value === '-' || value === '*' || value === '+')) {
      options.bullet = value;
    } else {
      fail();
    }
  }
  return options;
}

/**
 * Renders headings as a nested Markdown list of links. Levels outside
 * `minDepth`..`maxDepth` and headings marked `<!-- omit in toc -->` are left
 * out. Skipped levels (an `####` right under a `##`) nest one step, never
 * more, so the list always renders correctly.
 */
export function renderToc(headings: readonly Heading[], options: TocOptions = {}): string {
  const o = resolve(options);
  const lines: string[] = [];
  // Each open level: heading level, the column its children start at, and
  // the next number for ordered lists.
  const stack: { level: number; column: number; next: number }[] = [];
  let topNext = 1;
  for (const h of headings) {
    if (h.omit || h.level < o.minDepth || h.level > o.maxDepth) continue;
    while (stack.length > 0 && stack[stack.length - 1]!.level >= h.level) stack.pop();
    const parent = stack[stack.length - 1];
    const indent = parent ? parent.column : 0;
    let marker: string = o.bullet;
    if (o.ordered) {
      const n = parent ? parent.next++ : topNext++;
      marker = `${n}.`;
    }
    lines.push(`${' '.repeat(indent)}${marker} [${h.text}](#${h.slug})`);
    stack.push({ level: h.level, column: indent + marker.length + 1, next: 1 });
  }
  return lines.join('\n');
}

export interface UpdateOptions extends TocOptions {
  /**
   * When the document has no `<!-- toc -->` marker, add one (with its TOC)
   * right before the first section: the first heading after the `#` title,
   * or the first heading when there is no title. Default false.
   */
  insert?: boolean;
}

export interface UpdateResult {
  /** The updated document (the input itself when nothing changed). */
  markdown: string;
  /** True when the TOC was missing or out of date. */
  changed: boolean;
  /** True when the document has a `<!-- toc -->` marker (including one added by `insert`). */
  found: boolean;
  /** True when `insert` added the markers because the document had none. */
  inserted: boolean;
  /** All headings in the document. */
  headings: Heading[];
}

/**
 * Writes the table of contents between `<!-- toc -->` and `<!-- tocstop -->`
 * (or `<!-- /toc -->`). With only a start marker, the TOC and an end marker
 * are inserted after it. Without markers the document is returned unchanged
 * with `found: false`. Options in the marker override `options`. Line
 * endings (LF or CRLF) are kept.
 *
 * The heading directly above the start marker (with only blank lines in
 * between, like "## Contents") is treated as the TOC's title and left out.
 */
export function updateToc(markdown: string, options: UpdateOptions = {}): UpdateResult {
  const { insert, ...tocOptions } = options;
  const { headings, markers, lines } = scan(markdown);
  if (!markers) {
    const at = insert ? insertionLine(headings) : undefined;
    if (at === undefined) return { markdown, changed: false, found: false, inserted: false, headings };
    resolve(tocOptions);
    const eol = markdown.includes('\r\n') ? '\r\n' : '\n';
    const before = lines.slice(0, at);
    if (before.length > 0 && before[before.length - 1]!.trim() !== '') before.push('');
    const withMarkers = [...before, '<!-- toc -->', '<!-- tocstop -->', '', ...lines.slice(at)].join(eol);
    return { ...updateToc(withMarkers, tocOptions), changed: true, inserted: true };
  }

  const markerOptions = parseMarkerOptions(markers.options, markers.start + 1);
  const merged = { ...tocOptions, ...markerOptions };
  resolve(merged, markers.start + 1);

  let title = markers.start - 1;
  while (title >= 0 && lines[title]!.trim() === '') title--;
  const isSetextUnderline = title >= 1 && /^ {0,3}(=+|-+)[ \t]*$/.test(lines[title]!);
  const titleLine = (isSetextUnderline ? title - 1 : title) + 1;
  const included = headings.filter((h) => {
    if (h.line - 1 > markers.start && markers.end !== -1 && h.line - 1 < markers.end) return false;
    return h.line !== titleLine;
  });

  const list = renderToc(included, merged);
  const startLine = lines[markers.start]!.trim();
  const block =
    list === ''
      ? [startLine, '', markers.endMarker]
      : [startLine, '', ...list.split('\n'), '', markers.endMarker];
  const end = markers.end === -1 ? markers.start : markers.end;
  const current = lines.slice(markers.start, end + 1);
  const changed =
    markers.end === -1 || current.length !== block.length || current.some((l, k) => l !== block[k]);
  if (!changed) return { markdown, changed: false, found: true, inserted: false, headings };

  const eol = markdown.includes('\r\n') ? '\r\n' : '\n';
  const out = [...lines.slice(0, markers.start), ...block, ...lines.slice(end + 1)];
  return { markdown: out.join(eol), changed: true, found: true, inserted: false, headings };
}

/**
 * The 0-based line to put new markers on: the first heading after the first
 * `#` title, or the first heading of a document without a title. `undefined`
 * when there is no such heading.
 */
function insertionLine(headings: readonly Heading[]): number | undefined {
  const title = headings.findIndex((h) => h.level === 1);
  const section = title === -1 ? headings[0] : headings[title + 1];
  return section ? section.line - 1 : undefined;
}

/**
 * Builds a table of contents for a whole document and returns just the list,
 * for when you want to place it yourself.
 */
export function toc(markdown: string, options: TocOptions = {}): string {
  return renderToc(scan(markdown).headings, options);
}

/** True when the document has a marker and its TOC is current. */
export function isTocUpToDate(markdown: string, options: TocOptions = {}): boolean {
  const result = updateToc(markdown, options);
  return result.found && !result.changed;
}
