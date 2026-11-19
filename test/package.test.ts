import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import * as esm from '../src/index.js';

const require = createRequire(import.meta.url);
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('package', () => {
  it('the CommonJS build exposes the same API', () => {
    const cjs = require('../cjs/index.js') as typeof esm;
    assert.deepEqual(Object.keys(cjs).sort(), Object.keys(esm).sort());
    assert.equal(cjs.slugify('বাংলা ভাষা'), 'বাংলা-ভাষা');
  });

  it('the CommonJS folder is marked as commonjs', () => {
    assert.equal(JSON.parse(read('../cjs/package.json')).type, 'commonjs');
  });

  it('has no runtime dependencies and versions agree', () => {
    const pkg = JSON.parse(read('../../package.json'));
    assert.equal(pkg.dependencies, undefined);
    assert.equal(pkg.version, esm.VERSION);
    assert.equal(pkg.name, '@saizul/md-toc');
    assert.equal(pkg.bin['md-toc'], './dist/esm/cli.js');
  });

  it('the CLI entry starts with a shebang', () => {
    assert.ok(read('../esm/cli.js').startsWith('#!/usr/bin/env node'));
  });

  it("the README's own table of contents is up to date", () => {
    for (const file of ['../../README.md', '../../CONTRIBUTING.md']) {
      assert.ok(esm.isTocUpToDate(read(file)), `${file}: run node dist/esm/cli.js README.md CONTRIBUTING.md`);
    }
  });

  it('the README documents every export', () => {
    const readme = read('../../README.md');
    for (const name of Object.keys(esm)) assert.ok(readme.includes(`\`${name}`), name);
  });

  it('action.yml runs the check with every input', () => {
    const action = read('../../action.yml');
    for (const input of ['files', 'min-depth', 'max-depth', 'ordered', 'bullet', 'strict', 'node-version']) {
      assert.match(action, new RegExp(`^ {2}${input}:`, 'm'), input);
      assert.ok(action.includes(`inputs.${input}`), `${input} is used`);
    }
    assert.match(action, /using: composite/);
    assert.match(action, /--check/);
    // Inputs reach the shell through environment variables, never inline.
    assert.doesNotMatch(action.slice(action.indexOf('run:')), /run:[^\n]*\$\{\{/);
  });
});
