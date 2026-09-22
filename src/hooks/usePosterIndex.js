import { useEffect, useState } from 'react';
import { loadPosterIndex } from '../services/posterIndex';

// The poster index as React state: null until it has loaded, then identifier -> entry
export default function usePosterIndex() {
  const [index, setIndex] = useState(null);
  useEffect(() => { loadPosterIndex().then(setIndex); }, []);
  return index;
}
