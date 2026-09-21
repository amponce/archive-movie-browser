import React, { useState, useEffect, useMemo, useId } from 'react';
import { Search, RefreshCw, Loader2, Film, Filter, Library, Clock, Link2, Tag, Trash2 } from 'lucide-react';
import archiveService, { STANDARD_GENRES, VIDEO_CATEGORIES } from '../services/archive';
import { matchRanges, localSuggestions, rememberSearch } from '../services/suggest';
import { parseArchiveUrl } from '../services/archiveUrl';

const RECENT_KEY = 'recent-searches';
const ICONS = { search: Search, link: Link2, film: Film, genre: Filter, collection: Library, tag: Tag, recent: Clock, clear: Trash2 };
const HINTS = { genre: 'Genre', collection: 'Collection', tag: 'Tag', recent: 'Recent search' };

// Archive.org answers in 1.5-4 s, so remember what it said for the rest of the visit
const remoteCache = new Map();
const NOTHING = { films: [], tags: [] };

function readRecent() {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter(item => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

// The matched part of each word in yellow, the rest as it is
function Highlighted({ text, ranges }) {
  const parts = [];
  let cursor = 0;
  (ranges || []).forEach(([start, end]) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(<span key={start} className="text-yellow-400 font-semibold">{text.slice(start, end)}</span>);
    cursor = end;
  });
  parts.push(text.slice(cursor));
  return <>{parts}</>;
}

// Search input with suggestions as you type. Instant matches come from what the page already
// has (genres, collections, loaded films, recent searches); film titles from Archive.org follow
// about a second later. Follows the ARIA combobox pattern: arrows move, Enter picks, Escape closes.
export default function SearchBox({ value, onChange, onSearch, onOpenFilm, onPickGenre, onPickCollection, movies, loading }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [remote, setRemote] = useState(NOTHING);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [recent, setRecent] = useState(readRecent);
  const listId = useId();

  const local = useMemo(
    () => localSuggestions(value, { genres: STANDARD_GENRES, collections: VIDEO_CATEGORIES, movies, recent }),
    [value, movies, recent]
  );

  // Titles and tags from Archive.org: wait for a pause in typing, cancel the previous request
  useEffect(() => {
    const text = value.trim().toLowerCase();
    if (!open || parseArchiveUrl(text) || !archiveService.buildSuggestQuery(text)) {
      setRemote(NOTHING);
      setRemoteLoading(false);
      return;
    }
    if (remoteCache.has(text)) {
      setRemote(remoteCache.get(text));
      setRemoteLoading(false);
      return;
    }

    const controller = new AbortController();
    setRemoteLoading(true);
    const timer = setTimeout(() => {
      archiveService.suggest(text, { signal: controller.signal })
        .then(found => {
          remoteCache.set(text, found);
          setRemote(found);
          setRemoteLoading(false);
        })
        .catch(err => {
          if (err.name !== 'AbortError') setRemoteLoading(false); // suggestions are a nicety; fail quietly
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, open]);

  // One list: "search for ...", then genres, collections and recent searches, then films.
  // Films from the page and from Archive.org are ranked together: a title that starts with
  // what was typed comes before one that only contains it.
  const items = useMemo(() => {
    const text = value.trim();
    if (parseArchiveUrl(text)) return [{ type: 'link', label: text, ranges: [] }];
    const list = text ? [{ type: 'search', label: text, ranges: [] }] : [];
    list.push(...local.filter(s => s.type !== 'film'));
    // Tags uploaders use, unless the same words are already offered as a genre or collection
    const offered = new Set(list.map(item => item.label.toLowerCase()));
    list.push(...remote.tags.filter(tag => !offered.has(tag.label)).map(tag => ({ type: 'tag', ...tag })));

    const films = local.filter(s => s.type === 'film');
    const listed = new Set(films.map(s => archiveService.dedupeKey(s.label)));
    remote.films.forEach(movie => {
      const key = archiveService.dedupeKey(movie.title);
      const ranges = matchRanges(movie.title, text);
      if (ranges && !listed.has(key)) {
        listed.add(key);
        films.push({ type: 'film', label: movie.title, ranges, movie });
      }
    });
    const startsWithQuery = film => Number(film.ranges[0]?.[0] === 0);
    list.push(...films.sort((a, b) => startsWithQuery(b) - startsWithQuery(a)).slice(0, 8));
    // Recent searches are kept in this browser only; whenever some are shown, offer to forget them
    if (list.some(item => item.type === 'recent')) list.push({ type: 'clear', label: 'Clear recent searches', ranges: [] });
    return list;
  }, [value, local, remote]);

  useEffect(() => setActive(-1), [value]);

  const runSearch = (text) => {
    setOpen(false);
    if (parseArchiveUrl(text)) return onSearch(text); // a pasted link is not a search to remember
    const next = rememberSearch(recent, text);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* private mode */ }
    onSearch(text);
  };

  const pick = (item) => {
    setOpen(false);
    if (item.type === 'film') return onOpenFilm(item.movie);
    if (item.type === 'genre') return onPickGenre(item.genre);
    if (item.type === 'collection') return onPickCollection(item.collectionId);
    if (item.type === 'link') return runSearch(item.label);
    if (item.type === 'clear') {
      setRecent([]);
      try { localStorage.removeItem(RECENT_KEY); } catch { /* private mode */ }
      return;
    }
    onChange(item.label); // 'search' and 'recent' both run a full search
    runSearch(item.label);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (!items.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive(index => (index + step + items.length + (index === -1 && step === -1 ? 1 : 0)) % items.length);
    } else if (e.key === 'Enter') {
      if (open && active >= 0 && items[active]) pick(items[active]);
      else runSearch(value);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation(); // close the list, not whatever is behind it
      e.preventDefault();  // ...including a <dialog>, which closes on Escape's default action
      setOpen(false);
    }
  };

  const showList = open && (items.length > 0 || remoteLoading);

  return (
    <div className="flex-1 relative flex">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        type="text"
        role="combobox"
        aria-label="Search movies"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Search movies, or paste an Archive.org link"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => { setRecent(readRecent()); setOpen(true); }}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className="flex-1 pl-10 pr-4 py-2 bg-gray-800 text-white placeholder-gray-400 border border-gray-700 rounded-l-lg focus:outline-none focus:border-yellow-400 min-w-0"
      />
      <button
        onClick={() => runSearch(value)}
        disabled={loading}
        className="px-3 sm:px-4 py-2 bg-yellow-500 text-gray-900 font-medium rounded-r-lg hover:bg-yellow-400 disabled:opacity-50 flex items-center gap-1 sm:gap-2 flex-shrink-0"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        <span className="hidden sm:inline">Search</span>
      </button>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-full mt-1 z-50 max-h-[70vh] overflow-y-auto bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-1"
          onMouseDown={(e) => e.preventDefault()} // keep focus in the input so a click registers before blur
        >
          {items.map((item, index) => {
            const Icon = ICONS[item.type];
            return (
              <li
                key={`${item.type}-${item.movie?.identifier || item.label}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(item)}
                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer text-sm ${index === active ? 'bg-gray-700' : ''} ${item.type === 'clear' ? 'border-t border-gray-700 mt-1' : ''}`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${item.type === 'film' ? 'text-yellow-400' : 'text-gray-400'}`} />
                <span className={`flex-1 min-w-0 truncate ${item.type === 'clear' ? 'text-gray-400' : 'text-gray-100'}`}>
                  {item.type === 'search' ? <>Search for “{item.label}”</>
                    : item.type === 'link' ? <>Open this Archive.org link</>
                    : <Highlighted text={item.label} ranges={item.ranges} />}
                </span>
                <span className="flex-shrink-0 text-xs text-gray-500 tabular-nums">
                  {item.type === 'film' ? item.movie.year : HINTS[item.type]}
                </span>
              </li>
            );
          })}
          {remoteLoading && (
            <li role="presentation" className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Looking up titles on Archive.org
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
