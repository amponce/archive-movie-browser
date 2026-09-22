import React, { useEffect, useMemo, useState } from 'react';
import archiveService, { ALL_FILMS, runtimeFilter } from '../services/archive';
import tmdbService from '../services/tmdb';
import { LISTS } from '../lists/index';
import { featuredFor, shelfFor, countsOf, changesIn } from '../services/programme';
import PICKS from '../programme/featured.json';
import { indexedMatch } from '../services/posterIndex';
import { watchUrl as watch } from '../services/reel';
import FilmCard, { Sprockets } from '../ui/FilmCard';
import Button from '../ui/Button';
import Section, { CardGrid as Grid } from '../ui/Section';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import McpBanner from '../components/McpBanner';

// The front desk. Everything on it comes from the poster index except two live requests:
// what was uploaded this week, and the names of the films that still want a poster.

const REPO = 'https://github.com/amponce/archive-movie-browser';
const fmt = n => n.toLocaleString('en-US');

// Index entry -> what FilmCard shows
const fromIndex = ({ id, entry }) => ({ id, title: entry.t, year: entry.y, poster: tmdbService.getPosterUrl(entry.p, 'medium') });
// Archive.org movie -> the same
const fromArchive = m => ({ id: m.identifier, title: m.title, year: m.year, genre: m.genres?.[0], poster: null });

const plain = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/(more info(rmation)?( on| at)?:?\s*)?https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim();
const firstSentences = (text, max = 220) => {
  const t = plain(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' ')))}…`;
};

function useIndex() {
  const [index, setIndex] = useState(null);
  useEffect(() => {
    fetch(`${import.meta.env?.BASE_URL || '/'}poster-index.json`)
      .then(r => (r.ok ? r.json() : { films: {} }))
      .then(i => setIndex(i.films || {}))
      .catch(() => setIndex({}));
  }, []);
  return index;
}

function Hero({ featured, fileNumber }) {
  const [film, setFilm] = useState(null);
  useEffect(() => {
    if (!featured) return;
    archiveService.getMovieByIdentifier(featured.id).then(setFilm).catch(() => setFilm(null));
  }, [featured?.id]);
  if (!featured) return null;

  const { entry } = featured;
  const poster = tmdbService.getPosterUrl(entry.p, 'large');
  const meta = [entry.y, film?.creator, film?.runtimeMinutes > 0 && archiveService.formatRuntime(film.runtimeMinutes), film?.genres?.[0] !== 'Uncategorized' && film?.genres?.[0]].filter(Boolean).join(' · ');
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <section id="tonight" className="gutter rule grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 py-10 lg:py-12">
      <div className="lg:col-span-7 flex flex-col justify-between gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            <span className="eyebrow"><span className="inline-block w-2 h-2 rounded-full bg-signal mr-2 align-middle" />Tonight's orphan</span>
            <span className="label">{today} · changes in {changesIn()}</span>
          </div>
          <h1 className="font-display font-black uppercase leading-[0.86] tracking-[0.005em] text-[56px] sm:text-[88px] lg:text-[128px]">{entry.t}</h1>
          <p className="text-lg text-muted leading-relaxed max-w-[560px]">
            {meta && <span className="text-bone">{meta}. </span>}
            {featured.why || (film?.description ? firstSentences(film.description) : '')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button href={watch(featured.id)} size="lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l14 8-14 8z" /></svg> Watch now
          </Button>
          <span className="label">Streams from archive.org</span>
        </div>
      </div>
      <a href={watch(featured.id)} aria-label={`Watch ${entry.t}`} className="lg:col-span-5 relative block min-h-[420px] lg:min-h-[520px] rounded-lg overflow-hidden border border-white/[0.06] bg-[#3A1420] group">
        <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-ink/40" />
        <Sprockets />
        <span className="absolute top-5 left-8 right-8 flex justify-between items-start">
          <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-bone/80">Orphan file № {fileNumber}</span>
          {entry.v && <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink bg-bone px-2 py-1 rounded-sm">{entry.v.toFixed(1)} on TMDB</span>}
        </span>
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[88px] h-[88px] rounded-full bg-signal flex items-center justify-center group-hover:scale-105 transition-transform">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="#0E0E10" aria-hidden="true"><path d="M6 4l14 8-14 8z" /></svg>
        </span>
        <span className="absolute bottom-5 left-8 font-mono text-xs tracking-[0.12em] uppercase text-bone/80">{[entry.y, film?.runtimeMinutes > 0 && `${Math.round(film.runtimeMinutes)} min`].filter(Boolean).join(' · ')}</span>
      </a>
    </section>
  );
}

function Stats({ counts }) {
  const cells = [
    [counts.identified, 'films identified'],
    [counts.posters, 'with a poster on file'],
    [counts.wanted, 'still without a poster', true],
    [LISTS.length, 'curated runs'],
  ];
  return (
    <section className="rule grid grid-cols-2 lg:grid-cols-4">
      {cells.map(([n, label, hot], i) => (
        <div key={label} className={`flex flex-col gap-1 px-4 sm:px-8 lg:px-10 py-6 ${i % 2 === 0 ? 'border-r border-line' : ''} ${i < 2 ? 'border-b lg:border-b-0 border-line' : ''} ${i === 2 ? 'lg:border-r' : ''}`}>
          <span className={`font-display font-extrabold text-4xl sm:text-[44px] leading-none tabular-nums ${hot ? 'text-signal' : ''}`}>{fmt(n)}</span>
          <span className="label">{label}</span>
        </div>
      ))}
    </section>
  );
}

// What went up on archive.org most recently, feature-length, and only the ones with a poster:
// posters are resolved live (index first, TMDB after) because this week's uploads are too new
// for the index. Lookups are cached in the browser for a week.
async function withPosters(movies, want) {
  const out = [];
  const seen = new Set();
  for (let i = 0; i < movies.length && out.length < want; i += 8) {
    const batch = movies.slice(i, i + 8);
    const found = await Promise.all(batch.map(m => tmdbService.searchMovie(m.title, m.year, m.identifier).catch(() => null)));
    batch.forEach((m, j) => {
      const hit = found[j];
      if (hit?.posterPath && !seen.has(hit.id) && out.length < want) {
        seen.add(hit.id);
        out.push({ ...fromArchive(m), poster: tmdbService.getPosterUrl(hit.posterPath, 'medium') });
      }
    });
  }
  return out;
}

function Surfaced() {
  const [films, setFilms] = useState(null);
  useEffect(() => {
    archiveService.fetchMovies({ collection: ALL_FILMS, sortBy: 'publicdate', sortOrder: 'desc', rowsPerPage: 100 })
      .then(({ movies }) => withPosters(movies.filter(runtimeFilter({ minRuntime: 40 })), 6))
      .then(setFilms)
      .catch(() => setFilms([]));
  }, []);
  return (
    <Section id="surfaced" eyebrow="Just surfaced" title="New on the Archive" blurb="The latest feature-length uploads to archive.org. Come back tomorrow, there will be more." more="All newest" href="/browse?genre=all&sort=publicdate+desc&runtime=40">
      {films && films.length === 0 ? (
        <p className="text-muted">Archive.org didn't answer. <a href="/browse?genre=all&sort=publicdate+desc" className="text-bone underline">Try the browse page.</a></p>
      ) : (
        <Grid>{(films || Array.from({ length: 6 }, (_, i) => ({ id: `s${i}` }))).map((f, i) => (
          films ? <FilmCard key={f.id} film={f} href={watch(f.id)} label={i === 0 ? 'Newest' : null} /> : <span key={f.id} className="block aspect-[2/3] rounded-md bg-panel animate-pulse" />
        ))}</Grid>
      )}
    </Section>
  );
}

// The house genre. Popular horror from the collections, only films with a poster on file.
function Horror() {
  const [films, setFilms] = useState(null);
  useEffect(() => {
    archiveService.fetchMovies({ collection: ALL_FILMS, genre: 'Horror', sortBy: 'downloads', sortOrder: 'desc', rowsPerPage: 80 })
      .then(async ({ movies }) => {
        const features = movies.filter(runtimeFilter({ minRuntime: 40 }));
        const matches = await Promise.all(features.map(m => indexedMatch(m.identifier)));
        const seen = new Set(); // the same film is often uploaded more than once
        return features
          .map((m, i) => (matches[i]?.posterPath && !seen.has(matches[i].id) && seen.add(matches[i].id) ? { ...fromArchive(m), genre: 'Horror', poster: tmdbService.getPosterUrl(matches[i].posterPath, 'medium') } : null))
          .filter(Boolean).slice(0, 12);
      })
      .then(setFilms)
      .catch(() => setFilms([]));
  }, []);
  if (films && films.length === 0) return null;
  return (
    <Section id="horror" eyebrow="The house genre" title="Horror, mostly unclaimed" blurb="The most-watched horror in the collections. Nobody renewed the rights, so they're yours." more="All horror" href="/browse?genre=Horror">
      <Grid>{(films || Array.from({ length: 6 }, (_, i) => ({ id: `h${i}` }))).map(f => (
        films ? <FilmCard key={f.id} film={f} href={watch(f.id)} /> : <span key={f.id} className="block aspect-[2/3] rounded-md bg-panel animate-pulse" />
      ))}</Grid>
    </Section>
  );
}

// A list tile: its title over a fan of three of its own posters
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

function Runs({ index }) {
  const tints = ['#1A2233', '#3A1420', '#2C2C31', '#2C1A3A'];
  return (
    <Section id="runs" eyebrow="Runs" title="Watch a run of them" blurb="Hand-picked lists with a note on every film. Anyone can write one." more="All runs" href="/lists">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {LISTS.map((list, i) => <RunTile key={list.slug} list={list} index={index} tint={tints[i % tints.length]} />)}
        <a href={`${REPO}/blob/main/src/lists/README.md`} className="flex flex-col justify-end gap-2 min-h-[220px] p-6 sm:p-7 rounded-lg border border-dashed border-line text-muted hover:border-bone hover:text-bone">
          <span className="display text-2xl">Write one</span>
          <span className="font-mono text-[11px] tracking-[0.1em]">One JSON file, one pull request</span>
        </a>
      </div>
    </Section>
  );
}

function Shelf({ index }) {
  const shelf = useMemo(() => shelfFor(index), [index]);
  if (!shelf) return null;
  return (
    <Section eyebrow="Today's shelf" title={`Pulled from the ${shelf.decade}s`} blurb="Six from one decade, a different decade every day." more={`All ${shelf.decade}s`} href={`/browse?genre=all&decade=${shelf.decade}`}>
      <Grid>{shelf.films.map(fromIndex).map(f => <FilmCard key={f.id} film={f} href={watch(f.id)} />)}</Grid>
    </Section>
  );
}

// The films the index gave up on. The number is the picture; no cards, the front desk shows posters.
function Wanted({ count }) {
  return (
    <section id="wanted" className="gutter pt-12 pb-16">
      <div className="panel grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center p-6 sm:p-8 lg:p-10">
        <div className="lg:col-span-5">
          <span className="eyebrow">Wanted</span>
          <p className="mt-2 font-display font-black leading-none text-signal text-[72px] sm:text-[112px] tabular-nums">{fmt(count)}</p>
          <p className="display text-2xl sm:text-3xl">films with no poster anywhere</p>
        </div>
        <div className="lg:col-span-7 flex flex-col gap-5">
          <p className="text-[17px] text-muted leading-relaxed max-w-[520px]">We looked on TMDB and OMDb and came up empty. Know where a one-sheet lives, or that a film is not what its upload says? A correction to the index lands with your name on it.</p>
          <Button variant="ghost" href={`${REPO}#poster-index`} className="self-start">Start hunting</Button>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const index = useIndex();
  const counts = useMemo(() => (index ? countsOf(index) : null), [index]);
  const featured = useMemo(() => (index ? featuredFor(index, new Date(), PICKS.films) : null), [index]);
  const fileNumber = useMemo(() => (featured ? String(Object.keys(index).indexOf(featured.id) + 1).padStart(5, '0') : ''), [index, featured]);

  return (
    <div className="min-h-screen">
      <McpBanner />
      <SiteHeader current="/" />
      {index && (
        <>
          <Hero featured={featured} fileNumber={fileNumber} />
          <Stats counts={counts} />
          <Horror />
          <Surfaced />
          <Runs index={index} />
          <Shelf index={index} />
          <Wanted count={counts.wanted} />
        </>
      )}
      <SiteFooter />
    </div>
  );
}
