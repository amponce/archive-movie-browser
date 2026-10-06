import React from 'react';
import { Check } from 'lucide-react';
import tmdbService from '../../services/tmdb';

// What /halloween's pieces share: a film's poster, its line of facts, the seen toggle, the crowd bar
export const posterOf = (entry, size = 'medium') => (entry?.p ? tmdbService.getPosterUrl(entry.p, size) : null);
export const titleOf = (entry, day) => entry?.t || day.film;
export const factsOf = (entry, day) => [entry?.y, (entry?.l || entry?.d) > 0 && `${Math.round(entry.l || entry.d)} min`, `Oct ${day.day}`].filter(Boolean).join(' · ');

// The label stays "Seen it"; aria-pressed says whether it is
export function SeenButton({ seen, onClick, large = false, className = '' }) {
  return (
    <button type="button" aria-pressed={seen} onClick={onClick}
      className={`btn ${large ? 'btn-lg' : ''} ${className} border ${seen ? 'border-signal text-bone' : 'border-line text-muted hover:text-bone hover:border-bone'}`}>
      <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full ${seen ? 'bg-signal text-ink' : 'border border-current'}`}>
        {seen && <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />}
      </span>
      Seen it
    </button>
  );
}

export function CrowdBar({ share }) {
  if (share === null) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="flex-1 h-1 rounded-full bg-line overflow-hidden" aria-hidden="true">
        <span className="block h-full bg-signal" style={{ width: `${share}%` }} />
      </span>
      <span className="font-mono text-[11px] tracking-[0.08em] uppercase text-muted whitespace-nowrap">{share}% have seen it</span>
    </div>
  );
}
