// Run after `npm run build`: node examples/basic.mjs
import { extractHeadings, slugify, updateToc } from '../dist/esm/index.js';

const readme = `# Demo

<!-- toc -->
<!-- tocstop -->

## 🚀 Quick start

## বাংলা ডকুমেন্টেশন

## Usage

### The \`parse()\` function

## Usage
`;

const { markdown, changed } = updateToc(readme);
console.log(markdown);
console.log('changed:', changed);

for (const h of extractHeadings(readme)) console.log(`h${h.level}  #${h.slug}`);
console.log(slugify('Q&A: what is new?'));
