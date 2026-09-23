import React, { useEffect, useState } from 'react';

// Picture-in-picture: the video floats in its own small window over every other app, so it keeps
// playing while you do something else. `video` returns the <video> element (it can change). Only
// shown where the browser supports it (Chrome, Edge, Safari; not Firefox).
export default function PopOut({ video, className = 'btn-ghost' }) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const sync = () => setOut(Boolean(document.pictureInPictureElement));
    document.addEventListener('enterpictureinpicture', sync, true);
    document.addEventListener('leavepictureinpicture', sync, true);
    return () => {
      document.removeEventListener('enterpictureinpicture', sync, true);
      document.removeEventListener('leavepictureinpicture', sync, true);
    };
  }, []);
  if (typeof document === 'undefined' || !document.pictureInPictureEnabled) return null;

  const toggle = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await video()?.requestPictureInPicture();
    } catch { /* the video isn't ready yet, or the browser said no */ }
  };
  return (
    <button type="button" onClick={toggle} aria-pressed={out} className={className} data-track="pop-out">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><rect x="12" y="11" width="8" height="6" rx="1" fill="currentColor" /></svg>
      {out ? 'Pop back in' : 'Pop out'}
    </button>
  );
}
