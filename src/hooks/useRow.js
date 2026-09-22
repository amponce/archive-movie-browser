import { useEffect, useState } from 'react';

// Cards for one row: undefined while loading, [] when nothing could be shown.
// `load` is one of the functions in services/rows.
export default function useRow(load) {
  const [cards, setCards] = useState(undefined);
  useEffect(() => {
    let cancelled = false;
    load().then(c => { if (!cancelled) setCards(c); }).catch(() => { if (!cancelled) setCards([]); });
    return () => { cancelled = true; };
  }, [load]);
  return cards;
}
