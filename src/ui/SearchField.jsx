import React, { useState } from 'react';
import SearchBox from '../components/SearchBox';

// The header's search on pages that are not the browser: the same type-ahead (genres,
// collections, recent searches, tags, live suggestions from Archive.org), with every pick
// taking you to the browse page or straight to the film.
const go = (query) => { window.location.href = `/browse?${query}`; };

export default function SearchField() {
  const [value, setValue] = useState('');
  return (
    <SearchBox
      value={value}
      onChange={setValue}
      onSearch={(text) => text.trim() && go(`q=${encodeURIComponent(text.trim())}`)}
      onOpenFilm={(film) => { window.location.href = `/browse#${encodeURIComponent(film.identifier)}`; }}
      onPickGenre={(genre) => go(`genre=${encodeURIComponent(genre)}`)}
      onPickCollection={(id) => go(`collection=${encodeURIComponent(id)}`)}
      movies={[]}
    />
  );
}
