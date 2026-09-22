import React from 'react';
import Button from '../../ui/Button';

const REPO = 'https://github.com/amponce/archive-movie-browser';

// The films the index gave up on. The number is the picture.
export default function Wanted({ count }) {
  return (
    <section id="wanted" className="gutter pt-12 pb-16">
      <div className="panel grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center p-6 sm:p-8 lg:p-10">
        <div className="lg:col-span-5">
          <span className="eyebrow">Wanted</span>
          <p className="mt-2 font-display font-black leading-none text-signal text-[72px] sm:text-[112px] tabular-nums">{count.toLocaleString('en-US')}</p>
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
