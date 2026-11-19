export { type ErrorCode, TocError } from './errors.js';
export { extractHeadings, type Heading, type Markers, type Scan, scan } from './headings.js';
export { linkText, plainText } from './inline.js';
export { Slugger, slugify } from './slug.js';
export {
  isTocUpToDate,
  parseMarkerOptions,
  renderToc,
  type TocOptions,
  toc,
  type UpdateResult,
  updateToc,
} from './toc.js';
export { VERSION } from './version.js';
