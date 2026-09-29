import React, { useEffect, useState } from 'react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import Button from '../ui/Button';
import { Sprockets } from '../ui/FilmCard';
import { FILES } from '../services/collection';
import { loadPosterIndex } from '../services/posterIndex';
import tmdbService from '../services/tmdb';
import { watchUrl } from '../services/reel';

const years = list => list.map(f => f.entry?.y).filter(Boolean);
const lead = text => {
  const end = text.indexOf('. ');
  return end > 0 ? [text.slice(0, end + 1), text.slice(end + 2)] : [text, ''];
};

// The first sentence in bone, the rest muted, as on the TV page
function Story({ label, text }) {
  const [first, rest] = lead(text);
  return (
    <div className="flex flex-col gap-2 max-w-[640px]">
      <h3 className="eyebrow">{label}</h3>
      <p className="text-muted leading-relaxed"><span className="text-bone">{first}</span> {rest}</p>
    </div>
  );
}

function CaseFile({ file, next }) {
  const { entry } = file;
  const poster = entry?.p ? tmdbService.getPosterUrl(entry.p, 'large') : null;
  const title = entry?.t || file.id;
  const fields = [
    ['Made by', file.made],
    ['On', file.means],
    ['Filed under', (entry?.g || []).slice(0, 2).join(' · ')],
    ['Running time', entry?.l || entry?.d ? `${entry.l || entry.d} min` : null],
  ].filter(([, value]) => value);
  return (
    <section id={`f${file.no}`} aria-labelledby={`t${file.no}`} className="rule scroll-mt-4">
      <div className="gutter py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-4">
          <a href={watchUrl(file.id)} data-track="collection-poster" data-film={file.id} className="relative block aspect-[2/3] rounded-md overflow-hidden border border-white/[0.06] bg-black max-w-[300px] lg:max-w-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
            {poster && <img src={poster} alt={`Poster for ${title}`} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />}
            <Sprockets />
            <span className="absolute top-3 left-5 right-5 flex justify-between items-start gap-3">
              <span className="font-mono text-[11px] tracking-[0.14em] uppercase text-bone/90 bg-ink/70 px-1.5 py-0.5 rounded-sm">File {file.no}</span>
              <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-ink bg-nitrate px-2 py-1 rounded-sm">Found</span>
            </span>
          </a>
        </div>
        <div className="lg:col-span-8 flex flex-col gap-6 min-w-0">
          <div className="flex flex-col gap-3">
            <span className="font-display font-black text-signal text-3xl tabular-nums">FILE {file.no}</span>
            <h2 id={`t${file.no}`} className="font-display font-black uppercase leading-[0.9] text-[40px] sm:text-[56px] lg:text-[64px] text-balance">
              {title} {entry?.y && <span className="text-dim">{entry.y}</span>}
            </h2>
            <p className="text-lg text-bone">{file.cause}</p>
          </div>
          <dl className="panel grid grid-cols-1 sm:grid-cols-2 overflow-hidden">
            {fields.map(([label, value]) => (
              <div key={label} className="px-4 py-3 border-b border-line sm:odd:border-r">
                <dt className="label">{label}</dt>
                <dd className="mt-1.5 text-sm">{value}</dd>
              </div>
            ))}
          </dl>
          <Story label="How it was lost" text={file.lost} />
          <Story label="How it was found" text={file.found} />
          <p className="max-w-[640px] border-l-2 border-nitrate pl-4 text-sm text-bone">
            <span className="block font-mono text-[11px] tracking-[0.12em] uppercase text-nitrate mb-1">File note</span>
            {file.fact}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button href={watchUrl(file.id)} size="lg" data-track="collection-watch" data-film={file.id}><span className="inline-block w-2 h-2 rounded-full bg-ink" aria-hidden="true" /> Watch it</Button>
            <Button href={next ? `#f${next.no}` : '#ledger'} variant="ghost" size="lg">{next ? 'Next file' : 'Back to the ledger'}</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// /collection: the Orphan Collection. Numbered case files: how each film was lost, and found.
export default function CollectionPage() {
  const [index, setIndex] = useState(null);
  useEffect(() => { document.title = 'The Orphan Collection | Orphaned Films'; }, []);
  useEffect(() => { loadPosterIndex().then(setIndex); }, []);

  // A film the index no longer shows has no file here
  const files = FILES.map(file => ({ ...file, entry: index?.[file.id] })).filter(file => !index || file.entry);
  const span = years(files);
  const range = span.length ? `${Math.min(...span)}–${Math.max(...span)}` : '';
  const first = files.slice(0, 6);

  return (
    <div className="min-h-screen bg-ink text-bone">
      <SiteHeader current="/collection" />
      <main>
        <section className="rule">
          <div className="gutter pt-10 lg:pt-14 pb-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
                <span className="eyebrow"><span className="inline-block w-2 h-2 rounded-full bg-nitrate mr-2 align-middle" aria-hidden="true" />Case files open</span>
                <span className="label">Volume I · {files.length} files{range && ` · ${range}`}</span>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-display font-black text-signal text-3xl">VOL. I</span>
                <h1 className="font-display font-black uppercase leading-[0.9] text-[48px] sm:text-[72px] lg:text-[96px]">The Orphan Collection</h1>
                <p className="text-lg text-muted leading-relaxed max-w-[620px]">
                  <span className="text-bone">Every film here fell through the cracks.</span> A studio went bankrupt, a court ordered it destroyed, its maker disowned it, or someone forgot to file a form. Each file tells how the film went missing, and how it was found.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button href="#f001" size="lg" data-track="collection-open"><span className="inline-block w-2 h-2 rounded-full bg-ink" aria-hidden="true" /> Open File 001</Button>
                <Button href="#ledger" variant="ghost" size="lg">The ledger</Button>
              </div>
            </div>
            <div className="lg:col-span-4 grid grid-cols-3 gap-3" aria-label="The first six files">
              {first.map(file => (
                <a key={file.no} href={`#f${file.no}`} className="relative block aspect-[2/3] rounded-md overflow-hidden border border-white/[0.06] bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                  {file.entry?.p && <img src={tmdbService.getPosterUrl(file.entry.p, 'medium')} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90 hover:opacity-100" />}
                  <span className="absolute bottom-1.5 left-2 font-mono text-[10px] tracking-[0.12em] text-bone bg-ink/70 px-1 rounded-sm">{file.no}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="ledger" className="rule scroll-mt-4" aria-labelledby="ledger-h">
          <div className="gutter py-10 flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="ledger-h" className="font-display font-black uppercase text-[32px] leading-none">The ledger</h2>
              <p className="text-muted">{files.length} files, in the order they were opened</p>
            </div>
            <div className="rounded-lg border border-line px-2">
              {files.map(file => (
                <a key={file.no} href={`#f${file.no}`} className="grid grid-cols-[56px_1fr] sm:grid-cols-[64px_minmax(0,1.1fr)_minmax(0,1fr)_72px] items-center gap-x-4 px-3 py-3 border-b border-line last:border-b-0 hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
                  <span className="font-display font-black text-2xl text-dim tabular-nums">{file.no}</span>
                  <span className="font-medium truncate">{file.entry?.t || file.id}</span>
                  <span className="hidden sm:block text-sm text-muted truncate">{file.cause}</span>
                  <span className="hidden sm:block font-mono text-xs text-dim tabular-nums text-right">{file.entry?.y}</span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {files.map((file, i) => <CaseFile key={file.no} file={file} next={files[i + 1]} />)}
      </main>
      <SiteFooter />
    </div>
  );
}
