import React from 'react';
import Section, { CardGrid } from '../../ui/Section';
import FilmCard from '../../ui/FilmCard';
import { FILES } from '../../services/collection';
import tmdbService from '../../services/tmdb';

// The Orphan Collection on the front page: the first six case files, each card badged with its
// file number and the line that says how it was lost. `index` is the poster index.
export default function CollectionPromo({ index }) {
  const files = FILES.filter(file => index?.[file.id]).slice(0, 6);
  if (!files.length) return null;
  return (
    <Section id="collection" eyebrow="Case files open" title="The Orphan Collection"
      blurb={`Every film here fell through the cracks. How each one went missing, and how it was found. ${FILES.length} files, and counting.`}
      more="Open the collection" href="/collection">
      <CardGrid>
        {files.map(file => {
          const entry = index[file.id];
          const film = { id: file.id, title: entry.t, year: entry.y, poster: tmdbService.getPosterUrl(entry.p, 'medium') };
          return (
            <FilmCard key={file.no} film={film} href={`/collection#f${file.no}`} label={`File ${file.no}`} track="row-collection">
              <span className="block mt-1.5 text-[13px] text-muted leading-snug">{file.cause}</span>
            </FilmCard>
          );
        })}
      </CardGrid>
    </Section>
  );
}
