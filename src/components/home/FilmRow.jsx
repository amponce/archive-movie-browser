import React from 'react';
import Section, { CardGrid } from '../../ui/Section';
import FilmCard from '../../ui/FilmCard';
import { watchUrl } from '../../services/reel';

// A row of film cards under a Section heading. `cards` is undefined while loading (skeletons),
// [] when there is nothing to show (the row disappears), else the cards.
export default function FilmRow({ cards, skeletons = 6, firstLabel, ...section }) {
  if (cards && cards.length === 0) return null;
  return (
    <Section {...section}>
      <CardGrid>
        {cards
          ? cards.map((card, i) => <FilmCard key={card.id} film={card} href={watchUrl(card.id)} label={i === 0 ? firstLabel : null} />)
          : Array.from({ length: skeletons }, (_, i) => <span key={i} className="film-frame bg-panel animate-pulse" />)}
      </CardGrid>
    </Section>
  );
}
