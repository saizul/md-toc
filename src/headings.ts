import { linkText, plainText } from './inline.js';
import { Slugger } from './slug.js';

/** One heading found in a Markdown document. */
export interface Heading {
  /** 1 for `#`, 2 for `##` (and setext `---`), up to 6. */
  level: number;
  /** The heading's inline Markdown as written, without `#` marks. */
  markdown: string;
  /** The text used for the TOC link (links unwrapped, brackets escaped). */
  text: string;
  /** The rendered text content, which the anchor is made from. */
  plain: string;
  /** The GitHub anchor, unique within the document, without `#`. */
  slug: string;
  /** 1-based line number. */
  line: number;
  /** True when the heading has an `<!-- omit in toc -->` comment. */
  omit: boolean;
}

/** Where the TOC markers are, as 0-based line indices. */
export interface Markers {
  start: number;
  /** -1 when there is a start marker but no end marker. */
  end: number;
  /** Options written in the start marker, e.g. `<!-- toc max-depth=3 -->`. */
  options: string;
  /** The end marker as written, so updates keep the user's style. */
  endMarker: string;
}

export interface Scan {
  headings: Heading[];
  markers: Markers | undefined;
  lines: string[];
}

const ATX = /^ {0,3}(#{1,6})(?=[ \t]|$)(.*)$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const FENCE_OPEN = /^[ \t]*(?:(?:[-*+]|\d{1,9}[.)])[ \t]+|>[ \t]?)*(`{3,}|~{3,})(.*)$/;
const START = /^[ \t]*<!--[ \t]*toc(?:[ \t]+([^>]*?))?[ \t]*-->[ \t]*$/i;
const END = /^[ \t]*<!--[ \t]*(?:tocstop|\/toc)[ \t]*-->[ \t]*$/i;
const OMIT = /<!--[ \t]*(?:omit (?:in|from) toc|toc:?[ \t]*(?:skip|ignore))[ \t]*-->/i;
/** Lines that cannot be part of a paragraph that turns into a setext heading. */
const NOT_PARAGRAPH =
  /^ {0,3}(?:[-*+](?:[ \t]|$)|\d{1,9}[.)](?:[ \t]|$)|>|<|\||#|(?:\*[ \t]*){3,}$|(?:_[ \t]*){3,}$|(?:-[ \t]*){3,}$)/;

/**
 * Finds the headings in a Markdown document, GitHub style. Headings inside
 * fenced code blocks, HTML comments and YAML front matter are ignored. Every
 * heading gets a unique anchor, even the ones a TOC leaves out, because
 * GitHub numbers duplicates across the whole page.
 */
export function scan(markdown: string): Scan {
  const lines = markdown.split(/\r?\n/);
  const headings: Heading[] = [];
  const slugger = new Slugger();
  let markers: Markers | undefined;
  let fence: { char: string; length: number } | undefined;
  let inComment = false;
  let paragraph: { text: string[]; line: number } | undefined;

  const add = (level: number, raw: string, line: number) => {
    const omit = OMIT.test(raw);
    const markdownText = raw.replace(/<!--[\s\S]*?-->/g, '').trim();
    const plain = plainText(markdownText);
    headings.push({
      level,
      markdown: markdownText,
      text: linkText(markdownText),
      plain,
      slug: slugger.slug(plain),
      line: line + 1,
      omit,
    });
  };

  let i = 0;
  // YAML (---) or TOML (+++) front matter at the very top.
  const front = lines[0]?.replace(/^﻿/, '').trimEnd();
  if (front === '---' || front === '+++') {
    for (let j = 1; j < lines.length; j++) {
      const l = lines[j]!.trimEnd();
      if (l === front || (front === '---' && l === '...')) {
        i = j + 1;
        break;
      }
    }
  }

  for (; i < lines.length; i++) {
    const line = lines[i]!;
    if (fence) {
      const close = line.match(/^[ \t]*(?:>[ \t]?)*(`{3,}|~{3,})[ \t]*$/);
      if (close && close[1]![0] === fence.char && close[1]!.length >= fence.length) fence = undefined;
      continue;
    }
    if (inComment) {
      if (line.includes('-->')) inComment = false;
      continue;
    }
    const open = line.match(FENCE_OPEN);
    if (open && !(open[1]![0] === '`' && open[2]!.includes('`'))) {
      fence = { char: open[1]![0]!, length: open[1]!.length };
      paragraph = undefined;
      continue;
    }
    if (START.test(line)) {
      if (!markers) {
        markers = { start: i, end: -1, options: line.match(START)![1] ?? '', endMarker: '<!-- tocstop -->' };
      }
      paragraph = undefined;
      continue;
    }
    if (END.test(line)) {
      if (markers && markers.end === -1 && i > markers.start) {
        markers.end = i;
        markers.endMarker = line.trim();
      }
      paragraph = undefined;
      continue;
    }
    const trimmed = line.trimStart();
    if (trimmed.startsWith('<!--')) {
      if (!trimmed.includes('-->', 4)) inComment = true;
      paragraph = undefined;
      continue;
    }
    const atx = line.match(ATX);
    if (atx) {
      const content = atx[2]!.replace(/(?:^|[ \t]+)#+[ \t]*$/, '').trim();
      add(atx[1]!.length, content, i);
      paragraph = undefined;
      continue;
    }
    const setext = paragraph ? line.match(SETEXT) : null;
    if (setext && paragraph) {
      add(setext[1]![0] === '=' ? 1 : 2, paragraph.text.join(' '), paragraph.line);
      paragraph = undefined;
      continue;
    }
    if (line.trim() === '' || NOT_PARAGRAPH.test(line)) {
      paragraph = undefined;
    } else if (paragraph) {
      paragraph.text.push(line.trim());
    } else if (!/^(?: {4}|\t)/.test(line)) {
      paragraph = { text: [line.trim()], line: i };
    }
  }
  return { headings, markers, lines };
}

/** The headings of a Markdown document. See `scan()`. */
export function extractHeadings(markdown: string): Heading[] {
  return scan(markdown).headings;
}
