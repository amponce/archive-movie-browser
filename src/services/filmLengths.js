// Film lengths for the channels measured in the browser (the personal one and community ones),
// remembered in this browser so a film is measured once.
export const LENGTHS_KEY = 'tv-film-lengths';

// A bare { seconds: 0 } is an old failure marker, not a measurement: dropped, so it is measured again
export function readLengths() {
  let all;
  try { all = JSON.parse(localStorage.getItem(LENGTHS_KEY) || '{}') || {}; } catch { return {}; }
  return Object.fromEntries(Object.entries(all).filter(([, entry]) => entry && 'file' in entry));
}

// Merged into what is stored now, so lengths saved by another tab are kept
export function rememberLength(id, entry) {
  try { localStorage.setItem(LENGTHS_KEY, JSON.stringify({ ...readLengths(), [id]: entry })); } catch { /* private mode */ }
}

// Measure every id, at most `limit` at a time. onResult(id, entry) runs as each one lands, with
// entry null when it failed. Stops starting new ones once cancelled() is true.
export async function measureEach(ids, measure, onResult, { limit = 6, cancelled = () => false } = {}) {
  const queue = [...ids];
  const worker = async () => {
    while (queue.length && !cancelled()) {
      const id = queue.shift();
      let entry = null;
      try { entry = await measure(id); } catch { /* reported as null */ }
      if (!cancelled()) onResult(id, entry);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, worker));
}
