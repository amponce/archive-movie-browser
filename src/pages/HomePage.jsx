import React, { useMemo } from 'react';
import { LISTS } from '../lists/index';
import PICKS from '../programme/featured.json';
import SHELVES from '../programme/shelves.json';
import { leadAt, nextLead, shelfBesides, heardOfRow, featuredFor, shelfFor, wallFor, countsOf, shortRow } from '../services/programme';
import { popularRow, newestRow, cardFromIndex } from '../services/rows';
import usePosterIndex from '../hooks/usePosterIndex';
import useRow from '../hooks/useRow';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import McpBanner from '../components/McpBanner';
import Hero from '../components/home/Hero';
import FilmRow from '../components/home/FilmRow';
import Lists from '../components/home/Lists';
import ContinueWatching from '../components/home/ContinueWatching';
import OnAir from '../components/home/OnAir';
import Shelf from '../components/home/Shelf';

// The front desk. Tonight's film, the numbers, and rows with a reason. Everything comes from
// the poster index except two live rows (horror, newest), and those only show posters.

const today = leadAt(SHELVES.slots);
const upcoming = nextLead(SHELVES.slots);
const eighties = shelfBesides(SHELVES.eighties, today?.list);
const loadHorror = () => popularRow({ genre: 'Horror' });

export default function HomePage() {
  const index = usePosterIndex();
  const programme = useMemo(() => index && {
    featured: featuredFor(index, new Date(), PICKS.films),
    wall: wallFor(index),
    shelf: shelfFor(index),
    short: shortRow(index),
    heardOf: heardOfRow(index),
    counts: countsOf(index),
  }, [index]);
  const lead = LISTS.find(l => l.slug === today?.list);
  const westerns = LISTS.find(l => l.slug === SHELVES.westerns.list);
  const eightiesList = LISTS.find(l => l.slug === eighties?.list);
  const horror = useRow(loadHorror);
  const newest = useRow(newestRow);

  if (!programme) return <div className="min-h-screen"><McpBanner /><SiteHeader current="/" /></div>;
  const { featured, wall, shelf, short, heardOf, counts } = programme;
  // ponytail: the file number is the film's position in the index, which moves when the index is
  // rebuilt; a stable number needs a field in the index
  const fileNumber = String(Object.keys(index).indexOf(featured.id) + 1).padStart(5, '0');

  return (
    <div className="min-h-screen">
      <McpBanner />
      <SiteHeader current="/" />
      {lead && <Shelf list={lead} index={index} more={today.more} range={SHELVES.range}
        next={upcoming && { at: upcoming.at, title: LISTS.find(l => l.slug === upcoming.lead.list)?.title }} />}
      <ContinueWatching index={index} />
      <OnAir skip={[today?.list, eighties?.list, SHELVES.westerns.list]} />
      <FilmRow id="horror" cards={horror} eyebrow="The house genre" title="Horror, mostly unclaimed" blurb="The most-watched horror on the Archive, all of it free to watch here." more="All horror" href="/browse?genre=Horror" />
      {featured && <Hero featured={featured} fileNumber={fileNumber} wall={wall} />}
      <FilmRow id="tonight-short" cards={short.map(cardFromIndex)} eyebrow="The tonight question" title="Under 90 minutes" blurb="Feature films you can finish in an evening, well regarded, a different dozen every day." more="All under 90" href="/browse?genre=all&runtime=40&sort=tmdb_rating" />
      <FilmRow id="surfaced" cards={newest} firstLabel="Newest" eyebrow="Just surfaced" title="New on the Archive" blurb="The latest feature-length uploads to archive.org. Come back tomorrow, there will be more." more="All newest" href="/browse?genre=all&sort=publicdate+desc&runtime=40" />
      <Lists lists={LISTS} index={index} />
      {shelf && (
        <FilmRow cards={shelf.films.map(cardFromIndex)} eyebrow="Today's shelf" title={`Pulled from the ${shelf.decade}s`} blurb="Six from one decade, a different decade every day." more={`All ${shelf.decade}s`} href={`/browse?genre=all&decade=${shelf.decade}`} />
      )}
      {westerns && <Shelf list={westerns} index={index} more={SHELVES.westerns.more} lead={false} />}
      {heardOf.films.length > 0 && (
        <FilmRow id="heard-of" cards={heardOf.films.map(cardFromIndex)} eyebrow="Out of copyright" title="You've heard of these" blurb={`The best-known films from ${heardOf.lastYear} and before. US copyright has run out on every one of them, so they belong to everyone.`} more="All 1920s" href="/browse?genre=all&decade=1920" />
      )}
      {eightiesList && <Shelf list={eightiesList} index={index} more={eighties.more} lead={false} last />}
      <SiteFooter counts={counts} />
    </div>
  );
}
