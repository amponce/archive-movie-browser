import React, { useEffect, useState } from 'react';

// Picture-in-picture: the video floats in its own small window over every other app, so it keeps
// playing while you do something else. `video` returns the <video> element (it can change).
// Chrome and Edge do it from this button with the standard API. iPhone and iPad (every browser
// there is Safari underneath) have Apple's own switch, webkitSetPresentationMode. Chrome on
// Android does it its own way: a video playing full screen shrinks into a floating window when
// you leave the app, so there the button says so, then goes full screen (within the few seconds a
// tap allows). Hidden where none of these works (Firefox on a computer).
const android = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
const apple = v => typeof v?.webkitSupportsPresentationMode === 'function' && v.webkitSupportsPresentationMode('picture-in-picture');
const appleMayHave = () => typeof HTMLVideoElement !== 'undefined' && 'webkitSetPresentationMode' in HTMLVideoElement.prototype;
const HINT_MS = 1500;

export default function PopOut({ video, className = 'btn-ghost' }) {
  const [out, setOut] = useState(false);
  const [hint, setHint] = useState(false);
  useEffect(() => {
    const sync = (event) => setOut(Boolean(document.pictureInPictureElement) || event?.target?.webkitPresentationMode === 'picture-in-picture');
    document.addEventListener('enterpictureinpicture', sync, true);
    document.addEventListener('leavepictureinpicture', sync, true);
    document.addEventListener('webkitpresentationmodechanged', sync, true);
    return () => {
      document.removeEventListener('enterpictureinpicture', sync, true);
      document.removeEventListener('leavepictureinpicture', sync, true);
      document.removeEventListener('webkitpresentationmodechanged', sync, true);
    };
  }, []);
  if (typeof document === 'undefined' || (!document.pictureInPictureEnabled && !appleMayHave() && !android)) return null;

  // Android: say what happens next, then full screen and playing; leaving the app floats it
  const fullScreenThenLeave = () => {
    setHint(true);
    setTimeout(async () => {
      const v = video();
      try {
        if (v?.paused) await v.play();
        await (v?.requestFullscreen?.() ?? v?.webkitEnterFullscreen?.());
      } catch { /* the browser said no */ }
      setTimeout(() => setHint(false), 4000);
    }, HINT_MS);
  };
  const toggle = async () => {
    const v = video();
    try {
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); return; }
      if (v?.webkitPresentationMode === 'picture-in-picture') { v.webkitSetPresentationMode('inline'); return; }
      if (apple(v)) {
        // Apple's switch: straight from the tap, and the film must be playing to float
        if (v.paused) v.play().catch(() => {});
        v.webkitSetPresentationMode('picture-in-picture');
        return;
      }
      if (document.pictureInPictureEnabled) await v?.requestPictureInPicture();
      else if (android) fullScreenThenLeave();
      else v?.webkitEnterFullscreen?.(); // an iPhone without either switch: its own player has the button
    } catch {
      if (android) fullScreenThenLeave(); // an Android browser that has the button but refuses it
    }
  };
  return (
    <>
      <button type="button" onClick={toggle} aria-pressed={out} className={className} data-track="pop-out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><rect x="12" y="11" width="8" height="6" rx="1" fill="currentColor" /></svg>
        {out ? 'Pop back in' : 'Pop out'}
      </button>
      {hint && (
        <span role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-md bg-panel px-4 py-3 text-sm text-bone shadow-xl ring-1 ring-white/10">
          Going full screen. Then swipe home, and the film keeps playing in a small window.
        </span>
      )}
    </>
  );
}
