/** Error codes used by `TocError`. */
export type ErrorCode = 'INVALID_OPTION' | 'INVALID_MARKER';

/** Errors thrown by md-toc. `code` is stable public API. */
export class TocError extends Error {
  readonly code: ErrorCode;
  /** 1-based line number in the Markdown file, when the error is about a line. */
  readonly line: number | undefined;

  constructor(code: ErrorCode, message: string, line?: number) {
    super(message);
    this.name = 'TocError';
    this.code = code;
    this.line = line;
  }
}
