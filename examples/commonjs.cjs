// Run after `npm run build`: node examples/commonjs.cjs
const { isTocUpToDate, toc } = require('../dist/cjs/index.js');

const doc = '<!-- toc -->\n<!-- tocstop -->\n\n## Install\n\n## Usage\n\n### Options\n';
console.log(toc(doc, { ordered: true }));
console.log('up to date:', isTocUpToDate(doc));
