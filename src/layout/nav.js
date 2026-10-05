import { inOctober } from '../halloween/days.js';

export const NAV = [
  ['/', 'Tonight'],
  ['/tv', 'TV'],
  ['/browse', 'Browse'],
  ['/lists', 'Lists'],
  ['/collection', 'Collection'],
];
// Through October (Pacific time) the nav also leads to 31 Days of Horror
export const SEASONAL = ['/halloween', '31 Days'];
export const navFor = now => (inOctober(now) ? [...NAV, SEASONAL] : NAV);
