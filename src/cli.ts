#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { expand } from './cli/glob.js';
import { run } from './cli/run.js';

try {
  process.exitCode = run(process.argv.slice(2), {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
    readFile: (path) => readFileSync(path, 'utf8'),
    writeFile: (path, text) => writeFileSync(path, text),
    expand,
  });
} catch (err) {
  process.stderr.write(`md-toc: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 2;
}
