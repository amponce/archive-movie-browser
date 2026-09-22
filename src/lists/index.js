// Every list file, bundled at build time so a list page needs no request
import { collectLists } from '../services/lists';

const files = import.meta.glob('./*.json', { eager: true, import: 'default' });
export const LISTS = collectLists(Object.values(files));
