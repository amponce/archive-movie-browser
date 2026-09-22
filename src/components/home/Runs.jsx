import React from 'react';
import tmdbService from '../../services/tmdb';
import Section from '../../ui/Section';

const REPO = 'https://github.com/amponce/archive-movie-browser';
const TINTS = ['#1A2233', '#3A1420', '#2C2C31', '#2C1A3A', '#1C3A2C', '#3B2414'];

// A list as a tile: its title over a fan of three of its own posters
function RunTile({ list, index, tint }) {
  const posters = list.films.map(f => index[f.id]).filter(e => e?.p).slice(0, 3).map(e => tmdbService.getPosterUrl(e.p, 'small'));
  return (
    <a href={`/lists/${list.slug}`} className="group relative flex items-end min-h-[220px] p-6 sm:p-7 rounded-lg border border-white/[0.06] overflow-hidden hover:border-signal focus-visible:outline-none focus-visible:border-signal" style={{ background: tint }}>
      <span aria-hidden="true" className="absolute right-5 top-5 bottom-5 w-[46%] pointer-events-none">
        {posters.map((src, i) => (
          <img key={src} src={src} alt="" loading="lazy" className="absolute top-0 h-full aspect-[2/3] object-cover rounded-sm shadow-[0_8px_24px_rgba(0,0,0,0.5)] border border-white/10 transition-transform group-hover:-translate-y-1"
            style={{ right: `${i * 26}%`, transform: `rotate(${(1 - i) * 4}deg)`, zIndex: 3 - i }} />
        ))}
      </span>
      <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
      <span className="relative flex flex-col gap-2 max-w-[50%]">
        <span className="display text-[28px] text-bone">{list.title}</span>
        <span className="font-mono text-[11px] tracking-[0.1em] text-muted">{list.films.length} films · {list.curator}</span>
      </span>
    </a>
  );
}

export default function Runs({ lists, index }) {
  return (
    <Section id="runs" eyebrow="Runs" title="Watch a run of them" blurb="Hand-picked lists with a note on every film. Anyone can write one." more="All runs" href="/lists">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {lists.map((list, i) => <RunTile key={list.slug} list={list} index={index} tint={TINTS[i % TINTS.length]} />)}
        <a href={`${REPO}/blob/main/src/lists/README.md`} className="flex flex-col justify-end gap-2 min-h-[220px] p-6 sm:p-7 rounded-lg border border-dashed border-line text-muted hover:border-bone hover:text-bone">
          <span className="display text-2xl">Write one</span>
          <span className="font-mono text-[11px] tracking-[0.1em]">One JSON file, one pull request</span>
        </a>
      </div>
    </Section>
  );
}
