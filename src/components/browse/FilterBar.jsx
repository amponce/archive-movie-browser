import React, { useState } from 'react';
import { Clock, Filter, Settings, Grid, List, SlidersHorizontal, Library, ChevronDown, Calendar } from 'lucide-react';
import { BROWSABLE_COLLECTIONS, DECADES, ALL_FILMS } from '../../services/archive';
import { SORT_OPTIONS, RUNTIME_OPTIONS } from '../../services/urlFilters';

// The sticky bar under the header: what you are looking at, grid or list, the settings dialog,
// and the controls (collection, type, runtime, decade, sort). On phones the controls fold
// behind a one-line summary. Everything it shows comes from useBrowseFilters.
export default function FilterBar({ browse, viewMode, onViewMode, onOpenSettings }) {
  const { filters, currentCategory, acrossCollections, collectionDescription } = browse;
  const { activeSearch, category, contentType, minRuntime, decade, sort } = filters;
  const [open, setOpen] = useState(false);

  return (
    <div className="gutter py-3 border-t border-line bg-ink/95 backdrop-blur sticky top-0 z-40">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="label">{collectionDescription}</p>
          <div className="flex items-center gap-2">
            <div className="flex bg-panel border border-line rounded-full p-1">
              <button onClick={() => onViewMode('grid')} className={`p-2 rounded-full ${viewMode === 'grid' ? 'bg-bone text-ink' : 'text-muted hover:text-bone'}`} title="Grid view" aria-label="Grid view" aria-pressed={viewMode === 'grid'}>
                <Grid className="w-4 h-4" />
              </button>
              <button onClick={() => onViewMode('list')} className={`p-2 rounded-full ${viewMode === 'list' ? 'bg-bone text-ink' : 'text-muted hover:text-bone'}`} title="List view" aria-label="List view" aria-pressed={viewMode === 'list'}>
                <List className="w-4 h-4" />
              </button>
            </div>
            <button onClick={onOpenSettings} className="p-2 rounded-full border border-line text-muted hover:text-bone hover:border-bone" title="About the posters" aria-label="About the posters">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile disclosure keeps active choices visible without a tall sticky header. */}
        <button className="md:hidden flex items-center gap-2 w-full text-left text-xs text-muted" aria-expanded={open} aria-controls="catalogue-filters" onClick={() => setOpen(o => !o)}>
          <Filter className="w-4 h-4 shrink-0" />
          <span className="flex-1">Filters: {acrossCollections ? 'All collections' : currentCategory.name} · {contentType === 'trailers' ? 'Shorts, ≤30 min' : `Full Movies, ${minRuntime ? `${minRuntime}+ min` : 'any length'}`} · {decade ? `${decade}s · ` : ''}{SORT_OPTIONS[sort]}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        <div id="catalogue-filters" className={`${open ? 'flex' : 'hidden'} md:flex flex-wrap gap-2`}>
          <div className="control">
            <Library className="w-4 h-4 hidden sm:block" />
            <select value={activeSearch ? 'search' : category} aria-label="Collection" onChange={(e) => browse.changeCategory(e.target.value)}>
              {/* A search looks everywhere, so say so rather than keep showing a collection */}
              {activeSearch && <option value="search" disabled>Everything (searching)</option>}
              <option value={ALL_FILMS}>All Films</option>
              {BROWSABLE_COLLECTIONS.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </select>
          </div>

          <div className="seg">
            <button onClick={() => browse.changeType('features')} aria-pressed={contentType === 'features'}>Full Movies</button>
            <button onClick={() => browse.changeType('trailers')} aria-pressed={contentType === 'trailers'}>Shorts</button>
          </div>

          {/* Runtime. Shorts are hard-capped at ≤30 min, so do not show a live select. */}
          <div className="control">
            <Clock className="w-4 h-4 hidden sm:block" />
            {contentType === 'trailers' ? (
              <span className="font-mono text-xs uppercase cursor-default select-none" title="Shorts are limited to 30 minutes or less" aria-label="Runtime is limited to 30 minutes or less in Shorts mode">≤30 min</span>
            ) : (
              <select value={minRuntime} aria-label="Minimum runtime" onChange={(e) => browse.setMinRuntime(Number(e.target.value))}>
                {RUNTIME_OPTIONS.map(minutes => <option key={minutes} value={minutes}>{minutes === 0 ? 'Any length' : `${minutes}+ min`}</option>)}
              </select>
            )}
          </div>

          <div className="control">
            <Calendar className="w-4 h-4 hidden sm:block" />
            <select value={decade ?? ''} aria-label="Decade" onChange={(e) => browse.changeDecade(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Any decade</option>
              {[...DECADES].reverse().map(d => <option key={d} value={d}>{d}s</option>)}
            </select>
          </div>

          <div className="control">
            <SlidersHorizontal className="w-4 h-4 hidden sm:block" />
            <select value={sort} aria-label="Sort movies" onChange={(e) => browse.changeSort(e.target.value)}>
              {Object.entries(SORT_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
