import { useState } from 'react';

const VIEW_MODE_KEY = 'view-mode';

// Grid or list is a personal preference, so it lives in localStorage rather than the URL
function readViewMode() {
  try { return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'grid'; } catch { return 'grid'; }
}

export default function useViewMode() {
  const [viewMode, setViewMode] = useState(readViewMode);
  const changeViewMode = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch { /* private mode */ }
  };
  return [viewMode, changeViewMode];
}
