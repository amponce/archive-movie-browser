import React, { useMemo } from 'react';
import { LISTS } from '../lists/index';
import PICKS from '../programme/featured.json';
import { featuredFor, shelfFor, wallFor, countsOf } from '../services/programme';
import { popularRow, newestRow, cardFromIndex } from '../services/rows';
import usePosterIndex from '../hooks/usePosterIndex';
import useRow from '../hooks/useRow';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import McpBanner from '../components/McpBanner';
import Hero from '../components/home/Hero';
import Stats from '../components/home/Stats';
import FilmRow from '../components/home/FilmRow';
import Lists from '../components/home/Lists';
import Wanted from '../components/home/Wanted';
import ContinueWatching from '../components/home/ContinueWatching';

// The front desk. Tonight's film, the numbers, and rows with a reason. Everything comes from
// the poster index except two live rows (horror, newest), and those only show posters.

const loadHorror = () => popularRow({ genre: 'Horror' });

export default function HomePage() {
  const index = usePosterIndex();
  const programme = useMemo(() => index && {
    featured: featuredFor(index, new Date(), PICKS.films),
    wall: wallFor(index),
    shelf: shelfFor(index),
    counts: countsOf(index),
  }, [index]);
  const horror = useRow(loadHorror);
  const newest = useRow(newestRow);

  if (!programme) return <div className="min-h-screen"><McpBanner /><SiteHeader current="/" /></div>;
  const { featured, wall, shelf, counts } = programme;
  // ponytail: the file number is the film's position in the index, which moves when the index is
  // rebuilt; a stable number needs a field in the index
  const fileNumber = String(Object.keys(index).indexOf(featured.id) + 1).padStart(5, '0');

  return (
    <div className="min-h-screen">
      <McpBanner />
      <SiteHeader current="/" />
      {featured && <Hero featured={featured} fileNumber={fileNumber} wall={wall} />}
      <Stats cells={[
        [counts.identified, 'films identified'],
        [counts.posters, 'with a poster on file'],
        [counts.wanted, 'still without a poster', true],
        [LISTS.length, 'curated lists'],
      ]} />
      <ContinueWatching index={index} />
      <FilmRow id="horror" cards={horror} eyebrow="The house genre" title="Horror, mostly unclaimed" blurb="The most-watched horror in the collections. Nobody renewed the rights, so they're yours." more="All horror" href="/browse?genre=Horror" />
      <FilmRow id="surfaced" cards={newest} firstLabel="Newest" eyebrow="Just surfaced" title="New on the Archive" blurb="The latest feature-length uploads to archive.org. Come back tomorrow, there will be more." more="All newest" href="/browse?genre=all&sort=publicdate+desc&runtime=40" />
      <Lists lists={LISTS} index={index} />
      {shelf && (
        <FilmRow cards={shelf.films.map(cardFromIndex)} eyebrow="Today's shelf" title={`Pulled from the ${shelf.decade}s`} blurb="Six from one decade, a different decade every day." more={`All ${shelf.decade}s`} href={`/browse?genre=all&decade=${shelf.decade}`} />
      )}
      <Wanted count={counts.wanted} />
      <SiteFooter />
    </div>
  );
}
