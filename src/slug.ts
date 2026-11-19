/**
 * Characters GitHub drops from heading anchors: everything except letters
 * (Unicode `Alphabetic`), combining marks, decimal digits, connector
 * punctuation such as `_`, hyphens and spaces. This matches the
 * `github-slugger` package that GitHub-compatible tools use, so Bangla,
 * Hindi, Arabic or Chinese headings keep their letters and vowel signs while
 * emoji and punctuation disappear.
 */
const REMOVE = /[^\p{Alphabetic}\p{M}\p{Nd}\p{Pc} -]/gu;

/**
 * Turns plain heading text into a GitHub anchor (without the `#`). Does not
 * track duplicates; use `Slugger` for a whole document.
 *
 * ```ts
 * slugify('Hello, World!'); // 'hello-world'
 * slugify('🚀 Quick start'); // '-quick-start'
 * slugify('বাংলা ভাষা');     // 'বাংলা-ভাষা'
 * ```
 */
export function slugify(text: string): string {
  return text.toLowerCase().replace(REMOVE, '').replace(/ /g, '-');
}

/**
 * Generates unique anchors the way GitHub does: the second "Usage" heading
 * becomes `usage-1`, the third `usage-2`, and so on, skipping anchors that
 * are already taken.
 */
export class Slugger {
  private occurrences = new Map<string, number>();

  /** The unique anchor for the next heading with this text. */
  slug(text: string): string {
    const base = slugify(text);
    let result = base;
    while (this.occurrences.has(result)) {
      const n = this.occurrences.get(base)! + 1;
      this.occurrences.set(base, n);
      result = `${base}-${n}`;
    }
    this.occurrences.set(result, 0);
    return result;
  }

  /** Forgets every anchor seen so far. */
  reset(): void {
    this.occurrences.clear();
  }
}
