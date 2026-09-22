import React from 'react';
import FilmRow from './FilmRow';
import { unfinished, readPositions } from '../../services/playback';
import { cardFromIndex } from '../../services/rows';

// Films this browser started and did not finish. Positions live in localStorage, so this is
// per device and needs no account; the card shows how far along they are.
export default function ContinueWatching({ index }) {
  const films = unfinished(readPositions())
    .filter(f => index[f.identifier]?.p)
    .map(f => ({ ...cardFromIndex({ id: f.identifier, entry: index[f.identifier] }), progress: f.time / f.duration }));
  if (!films.length) return null;
  return <FilmRow id="continue" cards={films} eyebrow="Pick up where you left off" title="Continue watching" blurb="Kept on this device. Nothing is sent anywhere." />;
}
