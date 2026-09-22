import { useEffect, useState } from 'react';
import tmdbService from '../services/tmdb';
import archiveService from '../services/archive';
import { pickPlayableFile } from '../services/playback';
import { identifiedAs } from '../services/posterIndex';

// Everything the film page knows about a film beyond its Archive.org record: the TMDB match
// and its details, and how long the upload itself runs (the honest number, since an upload can
// be a trailer or a clip of the film TMDB describes).
export default function useFilmDetails(movie) {
  const [tmdbData, setTmdbData] = useState(null);
  const [tmdbDetails, setTmdbDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadMinutes, setUploadMinutes] = useState(null);

  useEffect(() => {
    if (!movie) return undefined;
    let cancelled = false;
    setLoading(true);
    setTmdbData(null); // clear the previous film's data so it cannot show under this one
    setTmdbDetails(null);
    tmdbService.searchMovie(movie.title, movie.year, movie.identifier).then(async (data) => {
      if (cancelled) return;
      setTmdbData(data);
      if (data?.id) {
        const details = await tmdbService.getMovieDetails(data.id);
        if (cancelled) return;
        setTmdbDetails(details);
      }
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [movie]);

  useEffect(() => {
    let cancelled = false;
    setUploadMinutes(null);
    if (!movie) return undefined;
    if (movie.runtimeMinutes > 0) { setUploadMinutes(movie.runtimeMinutes); return undefined; }
    archiveService.getMetadata(movie.identifier)
      .then(data => { const file = pickPlayableFile(data.files); if (!cancelled && file?.length) setUploadMinutes(Number(file.length) / 60); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [movie?.identifier]);

  const filmMinutes = tmdbDetails?.runtime || null;
  return {
    tmdbData, tmdbDetails, loading,
    identified: identifiedAs(movie, tmdbData),
    posterUrl: tmdbData?.posterPath ? tmdbService.getPosterUrl(tmdbData.posterPath, 'large') : null,
    backdropUrl: tmdbDetails?.backdrop_path ? tmdbService.getBackdropUrl(tmdbDetails.backdrop_path, 'w1280') : null,
    director: tmdbDetails?.credits?.crew?.find(c => c.job === 'Director'),
    cast: tmdbDetails?.credits?.cast?.slice(0, 6) || [],
    genres: tmdbDetails?.genres || movie?.genres?.map(g => ({ name: g })) || [],
    uploadMinutes, filmMinutes,
    isExcerpt: Boolean(uploadMinutes && filmMinutes && uploadMinutes < filmMinutes * 0.5),
  };
}
