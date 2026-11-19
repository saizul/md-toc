import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Slugger, slugify } from '../src/index.js';

describe('slugify', () => {
  // Expected values match GitHub's anchors (and the github-slugger package).
  const cases: [string, string][] = [
    ['Hello World', 'hello-world'],
    ['Hello, World!', 'hello-world'],
    ['  leading and trailing  ', '--leading-and-trailing--'],
    ['Multiple   spaces', 'multiple---spaces'],
    ['snake_case and kebab-case', 'snake_case-and-kebab-case'],
    ['v1.2.3', 'v123'],
    ['C++ & C#', 'c--c'],
    ["What's new?", 'whats-new'],
    ['a – b — c', 'a--b--c'],
    ['100% (approx.)', '100-approx'],
    ['🚀 Quick start', '-quick-start'],
    ['✨ Features ✨', '-features-'],
    ['👍🏽 thumbs', '-thumbs'],
    ['❤️ Love', '️-love'],
    ['বাংলা ভাষা', 'বাংলা-ভাষা'],
    ['ইনস্টল ও ব্যবহার', 'ইনস্টল-ও-ব্যবহার'],
    ['হিসাব ১২৩', 'হিসাব-১২৩'],
    ['हिन्दी शीर्षक', 'हिन्दी-शीर्षक'],
    ['日本語の見出し', '日本語の見出し'],
    ['Привет, мир!', 'привет-мир'],
    ['مرحبا بالعالم', 'مرحبا-بالعالم'],
    ['Ünïcödé STRASSE Straße', 'ünïcödé-strasse-straße'],
    ['x² and ½', 'x-and-'],
    ['Ⓐ circled', 'ⓐ-circled'],
    ['tab\there', 'tabhere'],
    ['', ''],
  ];
  for (const [text, slug] of cases) {
    it(JSON.stringify(text), () => {
      assert.equal(slugify(text), slug);
    });
  }
});

describe('Slugger', () => {
  it('numbers duplicates like GitHub', () => {
    const s = new Slugger();
    assert.deepEqual(
      ['Usage', 'Usage', 'Usage-1', 'Usage', 'usage'].map((t) => s.slug(t)),
      ['usage', 'usage-1', 'usage-1-1', 'usage-2', 'usage-3'],
    );
  });

  it('skips anchors that a later heading already took', () => {
    const s = new Slugger();
    assert.deepEqual(
      ['Foo-1', 'Foo', 'Foo'].map((t) => s.slug(t)),
      ['foo-1', 'foo', 'foo-2'],
    );
  });

  it('handles empty headings and reset()', () => {
    const s = new Slugger();
    assert.deepEqual(
      ['', '', '!!!'].map((t) => s.slug(t)),
      ['', '-1', '-2'],
    );
    s.reset();
    assert.equal(s.slug(''), '');
  });

  it('is not confused by Object.prototype keys', () => {
    const s = new Slugger();
    assert.deepEqual(
      ['constructor', '__proto__', 'constructor'].map((t) => s.slug(t)),
      ['constructor', '__proto__', 'constructor-1'],
    );
  });
});
