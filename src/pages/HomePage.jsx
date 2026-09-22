import React, { useEffect, useMemo, useState } from 'react';
import archiveService, { ALL_FILMS, runtimeFilter } from '../services/archive';
import tmdbService from '../services/tmdb';
import { LISTS } from '../lists/index';
import { featuredFor, rowFor, shelfFor, countsOf, changesIn } from '../services/programme';
import { indexedMatch } from '../services/posterIndex';
import FilmCard, { Sprockets } from '../components/FilmCard';

// The front desk. Everything on it comes from the poster index except two live requests:
// what was uploaded this week, and the names of the films that still want a poster.

const REPO = 'https://github.com/amponce/archive-movie-browser';
// The browse page opens a film from its hash. From here that is a real navigation, so the
// hash alone would not do: the front page does not watch it.
const watch = id => `/browse#${encodeURIComponent(id)}`;
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

function Eyebrow({ children }) {
  return <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-signal">{children}</span>;
}

function RowHeader({ eyebrow, title, blurb, more, href }) {
  return (
    <div className="flex items-end justify-between gap-6">
      <div className="flex flex-col gap-1.5 min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="font-display font-extrabold uppercase text-3xl sm:text-4xl leading-[0.95] tracking-[0.01em]">{title}</h2>
        {blurb && <p className="text-[15px] text-muted">{blurb}</p>}
      </div>
      {more && (
        <a href={href} className="shrink-0 flex items-center gap-2 py-2.5 min-h-[44px] font-mono text-xs tracking-[0.1em] uppercase text-muted hover:text-signal">
          {more} <span aria-hidden="true">→</span>
        </a>
      )}
    </div>
  );
}

const Grid = ({ children }) => <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">{children}</div>;

function Header({ total, onSpin }) {
  const link = 'py-2.5 font-mono text-xs tracking-[0.1em] uppercase text-muted hover:text-bone';
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 sm:px-8 lg:px-14 py-5 border-b border-line">
      <a href="/" className="flex items-center gap-3">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true"><rect x="2" y="2" width="24" height="24" rx="4" stroke="#F2EFE6" strokeWidth="2.5" /><rect x="7" y="7" width="14" height="14" rx="1.5" fill="#F2EFE6" /><rect x="19" y="4.5" width="4" height="3" rx="1" fill="#0E0E10" /></svg>
        <span className="flex flex-col gap-0.5">
          <span className="font-display font-black uppercase text-[28px] leading-[0.9] tracking-[0.02em]">Orphaned Films</span>
          <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-dim">Films from the Internet Archive</span>
        </span>
      </a>
      <nav className="hidden md:flex items-center gap-6">
        <a href="#tonight" className={`${link} text-bone`}>Tonight</a>
        <a href="#horror" className={link}>Horror</a>
        <a href="#surfaced" className={link}>Just surfaced</a>
        <a href="#runs" className={link}>Runs</a>
        <a href="/browse" className={link}>Browse</a>
        <a href="/mcp" className={link}>MCP</a>
      </nav>
      <div className="flex items-center gap-3 w-full md:w-auto">
        <form action="/browse" method="get" className="flex-1 md:flex-none">
          <label className="flex items-center gap-2.5 bg-panel border border-line rounded-full h-11 px-4 md:w-[240px] xl:w-[300px] focus-within:border-bone">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A867E" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input name="q" type="search" placeholder={`Search ${fmt(total)} films`} aria-label="Search films" className="bg-transparent w-full text-sm text-bone placeholder:text-dim focus:outline-none" />
          </label>
        </form>
        <button type="button" onClick={onSpin} className="flex items-center gap-2 h-11 px-4 rounded-full bg-bone text-ink font-mono text-xs tracking-[0.1em] uppercase font-medium hover:bg-signal">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 3h5v5" /><path d="M4 20L21 3" /><path d="M21 16v5h-5" /><path d="M15 15l6 6" /><path d="M4 4l5 5" /></svg>
          <span className="hidden sm:inline">Spin the reel</span><span className="sm:hidden">Spin</span>
        </button>
      </div>
    </header>
  );
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
    <section id="tonight" className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 px-4 sm:px-8 lg:px-14 py-10 lg:py-12 border-b border-line">
      <div className="lg:col-span-7 flex flex-col justify-between gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            <Eyebrow><span className="inline-block w-2 h-2 rounded-full bg-signal mr-2 align-middle" />Tonight's orphan</Eyebrow>
            <span className="font-mono text-[11px] tracking-[0.1em] uppercase text-dim">{today} · changes in {changesIn()}</span>
          </div>
          <h1 className="font-display font-black uppercase leading-[0.86] tracking-[0.005em] text-[56px] sm:text-[88px] lg:text-[128px]">{entry.t}</h1>
          <p className="text-lg text-muted leading-relaxed max-w-[560px]">
            {meta}{meta && film?.description ? '. ' : ''}{film?.description ? firstSentences(film.description) : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href={watch(featured.id)} className="flex items-center gap-2.5 px-6 py-4 rounded-full bg-signal text-ink font-mono text-[13px] tracking-[0.1em] uppercase font-medium hover:bg-bone">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l14 8-14 8z" /></svg> Watch now
          </a>
          <span className="font-mono text-[12px] tracking-[0.1em] uppercase text-dim">Streams from archive.org</span>
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
    <section className="grid grid-cols-2 lg:grid-cols-4 border-b border-line">
      {cells.map(([n, label, hot], i) => (
        <div key={label} className={`flex flex-col gap-1 px-4 sm:px-8 lg:px-10 py-6 ${i % 2 === 0 ? 'border-r border-line' : ''} ${i < 2 ? 'border-b lg:border-b-0 border-line' : ''} ${i === 2 ? 'lg:border-r' : ''}`}>
          <span className={`font-display font-extrabold text-4xl sm:text-[44px] leading-none tabular-nums ${hot ? 'text-signal' : ''}`}>{fmt(n)}</span>
          <span className="font-mono text-[11px] tracking-[0.12em] uppercase text-dim">{label}</span>
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
    <section id="surfaced" className="flex flex-col gap-7 px-4 sm:px-8 lg:px-14 pt-12">
      <RowHeader eyebrow="Just surfaced" title="New on the Archive" blurb="The latest feature-length uploads to archive.org. Come back tomorrow, there will be more." more="All newest" href="/browse?genre=all&sort=publicdate+desc&runtime=40" />
      {films && films.length === 0 ? (
        <p className="text-muted">Archive.org didn't answer. <a href="/browse?genre=all&sort=publicdate+desc" className="text-bone underline">Try the browse page.</a></p>
      ) : (
        <Grid>{(films || Array.from({ length: 6 }, (_, i) => ({ id: `s${i}` }))).map((f, i) => (
          films ? <FilmCard key={f.id} film={f} href={watch(f.id)} label={i === 0 ? 'Newest' : null} /> : <span key={f.id} className="block aspect-[2/3] rounded-md bg-panel animate-pulse" />
        ))}</Grid>
      )}
    </section>
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
    <section id="horror" className="flex flex-col gap-7 px-4 sm:px-8 lg:px-14 pt-12">
      <RowHeader eyebrow="The house genre" title="Horror, mostly unclaimed" blurb="The most-watched horror in the collections. Nobody renewed the rights, so they're yours." more="All horror" href="/browse?genre=Horror" />
      <Grid>{(films || Array.from({ length: 6 }, (_, i) => ({ id: `h${i}` }))).map(f => (
        films ? <FilmCard key={f.id} film={f} href={watch(f.id)} /> : <span key={f.id} className="block aspect-[2/3] rounded-md bg-panel animate-pulse" />
      ))}</Grid>
    </section>
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
        <span className="font-display font-extrabold uppercase text-[28px] leading-[0.95] text-bone">{list.title}</span>
        <span className="font-mono text-[11px] tracking-[0.1em] text-muted">{list.films.length} films · {list.curator}</span>
      </span>
    </a>
  );
}

function Runs({ index }) {
  const tints = ['#1A2233', '#3A1420', '#2C2C31', '#2C1A3A'];
  return (
    <section id="runs" className="flex flex-col gap-7 px-4 sm:px-8 lg:px-14 pt-12">
      <RowHeader eyebrow="Runs" title="Watch a run of them" blurb="Hand-picked lists with a note on every film. Anyone can write one." more="All runs" href="/lists" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {LISTS.map((list, i) => <RunTile key={list.slug} list={list} index={index} tint={tints[i % tints.length]} />)}
        <a href={`${REPO}/blob/main/src/lists/README.md`} className="flex flex-col justify-end gap-2 min-h-[220px] p-6 sm:p-7 rounded-lg border border-dashed border-line text-muted hover:border-bone hover:text-bone">
          <span className="font-display font-extrabold uppercase text-2xl leading-[0.95]">Write one</span>
          <span className="font-mono text-[11px] tracking-[0.1em]">One JSON file, one pull request</span>
        </a>
      </div>
    </section>
  );
}

function Shelf({ index }) {
  const shelf = useMemo(() => shelfFor(index), [index]);
  if (!shelf) return null;
  return (
    <section className="flex flex-col gap-7 px-4 sm:px-8 lg:px-14 pt-12">
      <RowHeader eyebrow="Today's shelf" title={`Pulled from the ${shelf.decade}s`} blurb="Six from one decade, a different decade every day." more={`All ${shelf.decade}s`} href={`/browse?genre=all&decade=${shelf.decade}`} />
      <Grid>{shelf.films.map(fromIndex).map(f => <FilmCard key={f.id} film={f} href={watch(f.id)} />)}</Grid>
    </section>
  );
}

// The films the index gave up on. The number is the picture; no cards, the front desk shows posters.
function Wanted({ count }) {
  return (
    <section id="wanted" className="px-4 sm:px-8 lg:px-14 pt-12 pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center p-6 sm:p-8 lg:p-10 rounded-lg border border-line bg-panel/60">
        <div className="lg:col-span-5">
          <Eyebrow>Wanted</Eyebrow>
          <p className="mt-2 font-display font-black leading-none text-signal text-[72px] sm:text-[112px] tabular-nums">{fmt(count)}</p>
          <p className="font-display font-extrabold uppercase text-2xl sm:text-3xl leading-[0.95]">films with no poster anywhere</p>
        </div>
        <div className="lg:col-span-7 flex flex-col gap-5">
          <p className="text-[17px] text-muted leading-relaxed max-w-[520px]">We looked on TMDB and OMDb and came up empty. Know where a one-sheet lives, or that a film is not what its upload says? A correction to the index lands with your name on it.</p>
          <a href={`${REPO}#poster-index`} className="self-start flex items-center gap-2 h-11 px-5 rounded-full border border-line font-mono text-xs tracking-[0.1em] uppercase text-bone hover:border-bone">Start hunting</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const link = 'font-mono text-[11px] tracking-[0.1em] uppercase text-dim hover:text-bone';
  return (
    <footer className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-8 lg:px-14 py-6 border-t border-line">
      <span className="font-mono text-[11px] tracking-[0.06em] text-dim">Every film here is hosted by the Internet Archive. We index, you watch there or here. Nothing is ours.</span>
      <span className="flex gap-6">
        <a href="/mcp" className={link}>MCP server</a>
        <a href={REPO} className={link}>GitHub</a>
        <a href="https://archive.org/details/movies" className={link}>Archive.org</a>
      </span>
    </footer>
  );
}

export default function HomePage() {
  const index = useIndex();
  const counts = useMemo(() => (index ? countsOf(index) : null), [index]);
  const featured = useMemo(() => (index ? featuredFor(index) : null), [index]);
  const fileNumber = useMemo(() => (featured ? String(Object.keys(index).indexOf(featured.id) + 1).padStart(5, '0') : ''), [index, featured]);

  const spin = () => {
    const pool = index ? rowFor(index, { limit: 400 }) : [];
    if (pool.length) window.location.href = watch(pool[Math.floor(Math.random() * pool.length)].id);
  };

  return (
    <div className="min-h-screen bg-ink text-bone font-sans">
      <Header total={counts?.identified || 0} onSpin={spin} />
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
      <Footer />
    </div>
  );
}
