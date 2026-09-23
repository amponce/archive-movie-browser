import React, { useEffect, useState } from 'react';
import archiveService from '../services/archive';
import { subtitleTracks } from '../services/playback';

// The subtitle files that go with one video of an upload (see subtitleTracks), read from the
// upload's file list. null while looking, [] when there are none.
export default function useSubtitles(identifier, videoUrl) {
  const [tracks, setTracks] = useState(null);
  const fileName = videoUrl ? decodeURIComponent(videoUrl.split('/').slice(5).join('/')) : '';
  useEffect(() => {
    let cancelled = false;
    setTracks(null);
    if (!identifier || !fileName) return undefined;
    archiveService.getMetadata(identifier)
      .then(data => { if (!cancelled) setTracks(subtitleTracks(data.files, fileName)); })
      .catch(() => { if (!cancelled) setTracks([]); });
    return () => { cancelled = true; };
  }, [identifier, fileName]);
  return tracks;
}

// The <track>s inside a <video>. They come through /api/subtitles because Archive.org won't serve
// subtitle files to other sites. English is on by default when there is a real English file.
export function SubtitleTracks({ identifier, tracks }) {
  return (tracks || []).map((t, i) => (
    <track key={t.file} kind="subtitles" label={t.label} srcLang={t.lang || undefined} default={i === 0 && t.lang === 'en'}
      src={`/api/subtitles?id=${encodeURIComponent(identifier)}&file=${encodeURIComponent(t.file)}`} />
  ));
}

// One line saying what there is, so a film without subtitles doesn't look broken
export function subtitleNote(tracks) {
  if (!tracks) return null;
  if (!tracks.length) return 'No subtitle file with this upload';
  return `Subtitles: ${tracks.map((t, i) => (i === 0 && t.lang === 'en' ? `${t.label} (on)` : t.label)).join(' · ')}. More in the player's ⋮ menu`;
}
