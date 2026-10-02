import React from 'react';
import { Heart } from 'lucide-react';
import useProfile from '../hooks/useProfile';

const SIZES = { overlay: 'p-1.5', inline: 'p-3' };

export default function FavouriteButton({ film, variant = 'overlay', className = '' }) {
  const { data, toggleFavourite } = useProfile();
  const on = (data?.favourites || []).includes(film);
  return (
    <button type="button" aria-pressed={on} aria-label={on ? 'Remove from favourites' : 'Save to favourites'}
      data-track="favourite" onClick={(e) => { e.stopPropagation(); toggleFavourite(film); }}
      className={`${SIZES[variant] || SIZES.overlay} rounded-full bg-ink/70 hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${on ? 'text-signal' : 'text-bone'} ${className}`}>
      <Heart size={16} fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}
