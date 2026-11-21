import { TocError } from '../errors.js';
import { type UpdateOptions, updateToc } from '../toc.js';
import { VERSION } from '../version.js';

export interface CliIO {
  stdout(text: string): void;
  stderr(text: string): void;
  readFile(path: string): string;
  writeFile(path: string, text: string): void;
  /** Expands a file, directory or glob argument to file paths. */
  expand(argument: string): string[];
}

const HELP = `Usage: md-toc [options] <file|dir|glob>...

Write a GitHub-compatible table of contents into Markdown files, between
<!-- toc --> and <!-- tocstop --> markers.

Options:
  -c, --check           do not write; exit 1 if any TOC is missing or stale
      --stdout          print the result instead of writing (one file only)
      --min-depth <N>   smallest heading level to include (default 2)
      --max-depth <N>   largest heading level to include (default 6)
      --ordered         numbered list instead of bullets
      --bullet <char>   bullet for unordered lists: -, * or + (default -)
      --insert          add markers before the first section of files that
                        have none (with --check: fail for those files)
      --strict          also fail when a file has no <!-- toc --> marker
  -q, --quiet           only print problems
  -h, --help            show this help
  -v, --version         show the version

Options in a marker override the command line for that file:
  <!-- toc max-depth=3 ordered -->

Examples:
  md-toc README.md
  md-toc --check README.md "docs/**/*.md"
  md-toc docs --max-depth 3

Exit codes: 0 up to date (or updated), 1 out of date with --check (or a
missing marker with --strict), 2 usage error, unreadable file or bad marker.
`;

class UsageError extends Error {}

interface Args {
  files: string[];
  check: boolean;
  stdout: boolean;
  strict: boolean;
  quiet: boolean;
  options: UpdateOptions;
}

function depth(flag: string, text: string): number {
  if (!/^[1-6]$/.test(text)) throw new UsageError(`${flag} must be a number from 1 to 6`);
  return Number(text);
}

function parseArgs(argv: string[]): Args | 'help' | 'version' {
  const args: Args = { files: [], check: false, stdout: false, strict: false, quiet: false, options: {} };
  let onlyFiles = false;
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i]!;
    let inline: string | undefined;
    if (!onlyFiles && arg.startsWith('--') && arg.includes('=')) {
      inline = arg.slice(arg.indexOf('=') + 1);
      arg = arg.slice(0, arg.indexOf('='));
    }
    const value = (): string => {
      if (inline !== undefined) return inline;
      const next = argv[++i];
      if (next === undefined) throw new UsageError(`${arg} needs a value`);
      return next;
    };
    if (onlyFiles || !arg.startsWith('-') || arg === '-') {
      if (arg === '-') throw new UsageError('reading from stdin is not supported; pass a file');
      args.files.push(arg);
    } else if (arg === '--') onlyFiles = true;
    else if (arg === '-h' || arg === '--help') return 'help';
    else if (arg === '-v' || arg === '--version') return 'version';
    else if (arg === '-c' || arg === '--check') args.check = true;
    else if (arg === '--stdout') args.stdout = true;
    else if (arg === '--strict') args.strict = true;
    else if (arg === '--insert') args.options.insert = true;
    else if (arg === '-q' || arg === '--quiet') args.quiet = true;
    else if (arg === '--ordered') args.options.ordered = true;
    else if (arg === '--min-depth') args.options.minDepth = depth(arg, value());
    else if (arg === '--max-depth') args.options.maxDepth = depth(arg, value());
    else if (arg === '--bullet') {
      const b = value();
      if (b !== '-' && b !== '*' && b !== '+') throw new UsageError('--bullet must be -, * or +');
      args.options.bullet = b;
    } else throw new UsageError(`unknown option "${arg}"`);
  }
  if (args.files.length === 0) throw new UsageError('no Markdown files given');
  if (args.check && args.stdout) throw new UsageError('--check and --stdout cannot be used together');
  const { minDepth = 2, maxDepth = 6 } = args.options;
  if (minDepth > maxDepth)
    throw new UsageError(`--min-depth (${minDepth}) is larger than --max-depth (${maxDepth})`);
  return args;
}

/** Replaces control characters in paths before printing them. */
function clean(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f-\u009f]/g, '?');
}

/** Runs the CLI and returns the exit code. All I/O goes through `io`. */
export function run(argv: string[], io: CliIO): number {
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs(argv);
  } catch (err) {
    if (!(err instanceof UsageError)) throw err;
    io.stderr(`md-toc: ${err.message}\nTry "md-toc --help".\n`);
    return 2;
  }
  if (args === 'help') {
    io.stdout(HELP);
    return 0;
  }
  if (args === 'version') {
    io.stdout(`${VERSION}\n`);
    return 0;
  }

  const files: string[] = [];
  for (const argument of args.files) {
    const found = io.expand(argument);
    if (found.length === 0) {
      io.stderr(`md-toc: no files match "${clean(argument)}"\n`);
      return 2;
    }
    for (const f of found) if (!files.includes(f)) files.push(f);
  }
  if (args.stdout && files.length !== 1) {
    io.stderr(`md-toc: --stdout needs exactly one file (got ${files.length})\n`);
    return 2;
  }

  let stale = 0;
  let missing = 0;
  let errors = 0;
  const say = (text: string) => {
    if (!args.quiet) io.stdout(text);
  };
  for (const file of files) {
    const name = clean(file);
    let text: string;
    try {
      text = io.readFile(file);
    } catch (err) {
      const code = (err as { code?: string }).code;
      io.stderr(`md-toc: cannot read ${name}${code ? ` (${code})` : ''}\n`);
      errors++;
      continue;
    }
    let result: ReturnType<typeof updateToc>;
    try {
      result = updateToc(text, args.options);
    } catch (err) {
      if (!(err instanceof TocError)) throw err;
      io.stderr(`md-toc: ${name}${err.line ? `:${err.line}` : ''}: ${err.message}\n`);
      errors++;
      continue;
    }
    if (args.stdout) {
      io.stdout(result.markdown);
      if (!result.found) io.stderr(`md-toc: ${name}: no <!-- toc --> marker\n`);
      return result.found || !args.strict ? 0 : 1;
    }
    if (!result.found) {
      missing++;
      (args.strict ? io.stderr : say)(
        `${args.strict ? 'md-toc: ' : ''}${name}: no <!-- toc --> marker, skipped\n`,
      );
    } else if (!result.changed) {
      say(`${name}: up to date\n`);
    } else if (args.check) {
      stale++;
      io.stderr(
        `md-toc: ${name}: ${result.inserted ? 'has no table of contents' : 'table of contents is out of date'}\n`,
      );
    } else {
      try {
        io.writeFile(file, result.markdown);
      } catch (err) {
        const code = (err as { code?: string }).code;
        io.stderr(`md-toc: cannot write ${name}${code ? ` (${code})` : ''}\n`);
        errors++;
        continue;
      }
      say(`${name}: ${result.inserted ? 'inserted a table of contents' : 'updated'}\n`);
    }
  }
  if (errors > 0) return 2;
  if (stale > 0) {
    const list = files.length === 1 ? clean(files[0]!) : '<files>';
    const flag = args.options.insert ? ' --insert' : '';
    io.stderr(`Run "md-toc${flag} ${list}" to update ${stale === 1 ? 'it' : 'them'}.\n`);
    return 1;
  }
  if (args.strict && missing > 0) return 1;
  return 0;
}
