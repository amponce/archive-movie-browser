import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import useProfile from '../hooks/useProfile';
import { readProfile } from '../services/profile';

const SIZES = { overlay: 'p-1.5', inline: 'p-3' };

export default function FavouriteButton({ film, variant = 'overlay', className = '' }) {
  const { data, toggleFavourite } = useProfile();
  const on = (data?.favourites || []).includes(film);
  const [saved, setSaved] = useState(null); // the profile a just-saved film went to

  useEffect(() => {
    if (!saved) return undefined;
    const t = setTimeout(() => setSaved(null), 3000);
    return () => clearTimeout(t);
  }, [saved]);

  const toggle = async () => {
    setSaved(null);
    const done = await toggleFavourite(film);
    const id = readProfile()?.id;
    if (!on && done && id) setSaved(id);
  };

  return (
    <div className={`relative ${className}`} onClick={e => e.stopPropagation()}>
      <button type="button" aria-pressed={on} aria-label={on ? 'Remove from favourites' : 'Save to favourites'}
        data-track="favourite" onClick={toggle}
        className={`${SIZES[variant] || SIZES.overlay} rounded-full bg-ink/70 hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${on ? 'text-signal' : 'text-bone'}`}>
        <Heart size={16} fill={on ? 'currentColor' : 'none'} />
      </button>
      <span role="status" className={`absolute left-0 top-full mt-1 w-max text-xs text-bone bg-ink z-30 ${saved ? 'border border-line px-2 py-1' : ''}`}>
        {saved && <a href={`/u/${saved}`} className="underline hover:text-signal">Saved to Favourites</a>}
      </span>
    </div>
  );
}
