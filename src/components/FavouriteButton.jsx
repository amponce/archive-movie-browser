import React from 'react';
import { Heart } from 'lucide-react';
import useProfile from '../hooks/useProfile';

export default function FavouriteButton({ film, className = '' }) {
  const { data, toggleFavourite } = useProfile();
  const on = (data?.favourites || []).includes(film);
  return (
    <button type="button" aria-pressed={on} aria-label={on ? 'Remove from favourites' : 'Save to favourites'}
      data-track="favourite" onClick={(e) => { e.stopPropagation(); toggleFavourite(film); }}
      className={`p-1.5 rounded-full bg-ink/70 hover:bg-ink ${on ? 'text-signal' : 'text-bone'} ${className}`}>
      <Heart size={16} fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}
