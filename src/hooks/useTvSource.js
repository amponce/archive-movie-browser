import { useEffect, useRef, useState } from 'react';
import { streamCopies } from '../services/playback';

const GIVE_UP_AFTER = 3; // films in a row that won't play: Archive.org isn't answering

// What a TV set plays for a film, and what it does when that won't play. An original mp4 can be
// video a browser can't decode, so its H.264 copies are tried first; then the set moves on to
// the next film, as it always did. Several films failing in a row means the trouble is
// Archive.org, not the films: the set stops and says so, instead of cycling the whole lineup.
export default function useTvSource(film, onSkip) {
  const [attempt, setAttempt] = useState(0);
  const [down, setDown] = useState(false);
  const failed = useRef(0);
  useEffect(() => setAttempt(0), [film?.id, film?.url]);

  const sources = film ? [film.url, ...streamCopies(film.url)] : [];
  const onError = () => {
    if (attempt + 1 < sources.length) return setAttempt(attempt + 1);
    failed.current += 1;
    if (failed.current >= GIVE_UP_AFTER) return setDown(true);
    onSkip();
  };
  const onPlaying = () => { failed.current = 0; };
  const retry = () => { failed.current = 0; setAttempt(0); setDown(false); };
  return { src: sources[attempt], onError, onPlaying, down, retry };
}
