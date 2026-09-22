import { useEffect, useRef, useState } from 'react';
import { VIDEO_CATEGORIES, ALL_FILMS, defaultMinRuntime, collectionChoice } from '../services/archive';
import { parseArchiveUrl } from '../services/archiveUrl';
import { parseFilters, filtersToQuery } from '../services/urlFilters';
import { track } from '../services/analytics';

// The browse page's filters: collection, genre, search, decade, runtime, type, sort. They live
// in the URL so any view is a link and Back works (#43): initialised from it, written back on
// every change, restored on popstate. `onReopenFilm(identifier)` is called when Forward lands
// on a film's history entry.
export default function useBrowseFilters({ onOpenFilmLink, onReopenFilm } = {}) {
  const [urlFilters] = useState(() => parseFilters(window.location.search));
  const [searchQuery, setSearchQuery] = useState(urlFilters.q);
  const [activeSearch, setActiveSearch] = useState(urlFilters.q);
  const [genre, setGenre] = useState(urlFilters.genre);
  const [minRuntime, setMinRuntime] = useState(urlFilters.runtime);
  const [contentType, setContentType] = useState(urlFilters.type); // 'features' or 'trailers'
  const [sort, setSort] = useState(urlFilters.sort);
  const [decade, setDecade] = useState(urlFilters.decade);
  const [category, setCategory] = useState(urlFilters.collection);

  const currentCategory = VIDEO_CATEGORIES.find(c => c.id === category)
    || { id: ALL_FILMS, name: 'All Films', description: 'Every film collection on the Internet Archive' };
  // Only a search looks outside the chosen collection; the genre pills narrow it
  const acrossCollections = Boolean(activeSearch);
  const collectionDescription = activeSearch
    ? 'Search results across all collections'
    : genre !== 'all' ? `${genre} in ${currentCategory.name}` : currentCategory.description;

  const changeCategory = (chosen) => {
    // A genre-named collection (from a pasted Archive.org link) means All Films and its pill
    const { collection: newCategory, genre: pill } = collectionChoice(chosen);
    // The site lands on the Horror pill; picking another library shows all of it (the pill
    // visibly moves to All Genres) rather than a near-empty "horror cartoons"
    setGenre(pill || 'all');
    track('Filter', { type: 'collection', value: newCategory });
    setCategory(newCategory);
    // Cartoons, Prelinger films and most uploads are short or have no runtime, so only
    // feature-film collections start on the 40+ minute filter
    setContentType('features');
    setMinRuntime(defaultMinRuntime(newCategory));
    // Searches span all collections, so picking one means going back to browsing it
    setSearchQuery('');
    setActiveSearch('');
  };

  const changeGenre = (next) => { track('Filter', { type: 'genre', value: next }); setGenre(next); };
  const changeSort = (next) => { track('Filter', { type: 'sort', value: next }); setSort(next); };
  const changeDecade = (next) => { track('Filter', { type: 'decade', value: next || 'any' }); setDecade(next); };
  const changeType = (next) => { setContentType(next); setMinRuntime(next === 'trailers' ? 0 : defaultMinRuntime(category)); };
  const pickGenre = (next) => { setSearchQuery(''); setActiveSearch(''); changeGenre(next); };
  const widen = () => { track('Filter', { type: 'collection', value: 'all (widened)' }); setCategory(ALL_FILMS); };

  const search = (text = searchQuery) => {
    // An Archive.org link opens what it points at instead of being searched for as words
    const link = parseArchiveUrl(text);
    if (link?.type === 'film') { setSearchQuery(''); track('Search', { kind: 'pasted link' }); return onOpenFilmLink?.(link.identifier); }
    if (link?.type === 'collection') return changeCategory(link.id);
    if (link?.type === 'search') text = link.query;
    if (text.trim()) track('Search', { query: text, kind: link ? 'pasted link' : 'typed' });
    setSearchQuery(text);
    setActiveSearch(text.trim());
    setGenre('all');
  };
  const typeSearch = (text) => { setSearchQuery(text); if (text === '') setActiveSearch(''); }; // emptying the box ends the search

  // Rebuild the query string from filter state, omitting defaults and keeping the existing
  // #identifier hash so film links and query filters coexist (#43).
  const urlSynced = useRef(false); // false until the arrival URL has been tidied
  const writeFiltersToUrl = (mode) => {
    const query = filtersToQuery({ collection: category, genre, q: activeSearch, decade, sort, runtime: minRuntime, type: contentType });
    const currentSearch = window.location.search.replace(/^\?/, '');
    // Already in sync: nothing to write. This also makes the sync effects safe on mount and
    // when popstate has just restored the state (no history spam).
    if (query === currentSearch) return;
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    if (mode === 'push' && urlSynced.current) window.history.pushState({}, '', url);
    else window.history.replaceState({}, '', url);
  };
  // Deliberate changes (collection, genre, search, decade) add a history entry so Back returns
  // to the previous view; minor ones only rewrite the current entry.
  useEffect(() => { writeFiltersToUrl('push'); urlSynced.current = true; }, [category, genre, activeSearch, decade]);
  useEffect(() => { writeFiltersToUrl('replace'); }, [sort, minRuntime, contentType]);

  // Back/Forward between filter views: restore the state from the URL. Forward can also land on
  // a film's history entry (open a film, Back, Forward): reopen it, or the film URL would sit on
  // a browse page and leak into the next film opened.
  useEffect(() => {
    const onPopState = (event) => {
      const identifier = event.state?.movieDetail && event.state.identifier;
      if (identifier) onReopenFilm?.(identifier);
      const restored = parseFilters(window.location.search);
      setCategory(restored.collection); setGenre(restored.genre);
      setActiveSearch(restored.q); setSearchQuery(restored.q);
      setSort(restored.sort); setDecade(restored.decade);
      setMinRuntime(restored.runtime); setContentType(restored.type);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return {
    filters: { searchQuery, activeSearch, genre, minRuntime, contentType, sort, decade, category },
    currentCategory, acrossCollections, collectionDescription,
    canWiden: !activeSearch && category !== ALL_FILMS,
    search, typeSearch, pickGenre, changeGenre, changeSort, changeDecade, changeType, changeCategory, setMinRuntime, widen,
  };
}
