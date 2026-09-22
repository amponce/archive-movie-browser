import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Filter } from 'lucide-react';
import { STANDARD_GENRES } from '../../services/archive';

// The genre pills. On phones they scroll sideways: the chosen pill is kept in view (also after
// a rotate, #125), and a fade at the right edge says there is more until you reach the end.
export default function GenrePills({ genre, onChange }) {
  const rowRef = useRef(null);
  const [atEnd, setAtEnd] = useState(false);

  // Scroll the chosen pill to the centre of the row, but only when the row scrolls (on desktop
  // the pills wrap). Move the row itself: scrollIntoView would also scroll the page.
  const scrollSelectedIntoView = useCallback(() => {
    const row = rowRef.current;
    if (!row || row.scrollWidth <= row.clientWidth) return;
    const pressed = row.querySelector('[aria-pressed="true"]');
    if (!pressed) return;
    const pill = pressed.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    row.scrollLeft += pill.left - box.left - (box.width - pill.width) / 2;
  }, []);

  useEffect(() => { scrollSelectedIntoView(); }, [genre, scrollSelectedIntoView]);
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;
    const observer = new ResizeObserver(scrollSelectedIntoView); // desktop to phone: wrapped becomes scrollable
    observer.observe(row);
    return () => observer.disconnect();
  }, [scrollSelectedIntoView]);
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return undefined;
    const update = () => setAtEnd(row.scrollLeft + row.clientWidth >= row.scrollWidth - 1);
    row.addEventListener('scroll', update, { passive: true });
    update();
    return () => row.removeEventListener('scroll', update);
  }, []);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <Filter className="w-4 h-4 text-dim" />
        <span className="label">Genre</span>
      </div>
      <div ref={rowRef} className={`flex flex-nowrap md:flex-wrap gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0 md:[mask-image:none] ${atEnd ? '' : '[mask-image:linear-gradient(to_right,black_94%,transparent)]'}`}>
        <button onClick={() => onChange('all')} aria-pressed={genre === 'all'} className={genre === 'all' ? 'pill-on' : 'pill'}>All Genres</button>
        {STANDARD_GENRES.map((g) => (
          <button key={g} onClick={() => onChange(g)} aria-pressed={genre === g} className={genre === g ? 'pill-on' : 'pill'}>{g}</button>
        ))}
      </div>
    </div>
  );
}
