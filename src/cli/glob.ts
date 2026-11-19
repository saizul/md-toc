import { readdirSync, statSync } from 'node:fs';
import { posix } from 'node:path';

/** Directories never searched by a glob, unless named in the pattern itself. */
const SKIP = new Set(['node_modules', '.git', '.hg', '.svn']);
const MARKDOWN = /\.(?:md|markdown|mdown|mkd)$/i;

/** True when the pattern contains glob syntax. */
export function isGlob(pattern: string): boolean {
  return /[*?[{]/.test(pattern);
}

/** Converts a glob (`*`, `**`, `?`, `[abc]`, `{a,b}`) to an anchored regular expression. */
export function globToRegExp(pattern: string): RegExp {
  let re = '';
  let braces = 0;
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i]!;
    if (ch === '*') {
      if (pattern[i + 1] === '*') {
        const slashAfter = pattern[i + 2] === '/';
        const atSegmentStart = i === 0 || pattern[i - 1] === '/';
        if (atSegmentStart && (slashAfter || i + 2 === pattern.length)) {
          re += slashAfter ? '(?:[^/]*/)*' : '.*';
          i += slashAfter ? 2 : 1;
          continue;
        }
        i++;
      }
      re += '[^/]*';
    } else if (ch === '?') {
      re += '[^/]';
    } else if (ch === '[') {
      const close = pattern.indexOf(']', i + 2);
      if (close === -1) {
        re += '\\[';
      } else {
        let body = pattern.slice(i + 1, close).replace(/\\/g, '\\\\');
        if (body.startsWith('!')) body = `^${body.slice(1)}`;
        re += `[${body}]`;
        i = close;
      }
    } else if (ch === '{') {
      braces++;
      re += '(?:';
    } else if (ch === '}' && braces > 0) {
      braces--;
      re += ')';
    } else if (ch === ',' && braces > 0) {
      re += '|';
    } else {
      re += ch.replace(/[.+^$()|\\\]{}]/g, '\\$&');
    }
  }
  return new RegExp(`^${re}$`);
}

function walk(dir: string, out: string[]): void {
  let entries: import('node:fs').Dirent[];
  try {
    entries = readdirSync(dir === '' ? '.' : dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = dir === '' ? entry.name : posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) walk(path, out);
    } else if (entry.isFile()) {
      out.push(path);
    }
  }
}

/**
 * Expands one command-line argument to Markdown file paths (with forward
 * slashes). A plain file is returned as is, a directory gives every Markdown
 * file below it, and a glob is matched against files under its fixed prefix.
 * `node_modules` and `.git` are skipped. Returns `[]` when nothing matches.
 */
export function expand(argument: string): string[] {
  const pattern = argument.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!isGlob(pattern)) {
    let stat: import('node:fs').Stats;
    try {
      stat = statSync(pattern);
    } catch {
      return [];
    }
    if (!stat.isDirectory()) return [pattern];
    const found: string[] = [];
    walk(pattern.replace(/\/+$/, ''), found);
    return found.filter((f) => MARKDOWN.test(f)).sort();
  }
  const segments = pattern.split('/');
  const fixed: string[] = [];
  for (const segment of segments.slice(0, -1)) {
    if (isGlob(segment)) break;
    fixed.push(segment);
  }
  const base = fixed.join('/');
  const found: string[] = [];
  walk(base, found);
  const re = globToRegExp(pattern);
  return found.filter((f) => re.test(f)).sort();
}
