import React, { useEffect, useRef } from 'react';
import { Play, X } from 'lucide-react';
import Button from '../../ui/Button';
import { watchUrl, playOnArrival } from '../../services/reel';
import { posterOf, titleOf, factsOf, SeenButton, CrowdBar } from './parts';

// One night's card, opened from its spine: a native modal <dialog>, so focus moves in, Tab stays
// inside and Escape closes it (through onClose, so the page decides); focus goes back to the spine. A sheet from the bottom on a phone.
export default function NightSheet({ day, entry, tonight, seen, onToggle, share, onClose, opener }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    closeRef.current.focus();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [opener]);

  // Native modality makes the page behind inert; wrap the ends too, so Tab never leaves for the
  // browser toolbar (as in hooks/useFilmDialog.js)
  const wrapTab = event => {
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current.querySelectorAll('button, a[href]')];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  const poster = posterOf(entry, 'large');
  return (
    <dialog ref={dialogRef} aria-labelledby="night-title" onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={wrapTab}
      onClick={event => { if (event.target === dialogRef.current) onClose(); }}
      className="bg-transparent p-0 m-0 mt-auto w-full max-w-none sm:m-auto sm:max-w-xl sm:p-4 backdrop:bg-ink/80">
      <div className="relative bg-panel border border-line rounded-t-2xl sm:rounded-xl text-bone p-5 sm:p-6 grid grid-cols-[96px_1fr] sm:grid-cols-[140px_1fr] gap-5 shadow-2xl">
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close"
          className="absolute top-2 right-2 p-2.5 rounded-full text-muted hover:text-bone hover:bg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal">
          <X className="w-5 h-5" />
        </button>
        <div className="film-frame bg-ink self-start">
          {poster && <img src={poster} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="min-w-0 flex flex-col gap-3 pr-6">
          <p className="eyebrow">Night {day.day}{tonight ? ' · Tonight' : ''}</p>
          <h2 id="night-title" className="font-display font-black uppercase leading-[0.9] text-3xl sm:text-4xl break-words">{titleOf(entry, day)}</h2>
          <p className="label">{factsOf(entry, day)}</p>
          <p className="text-muted leading-relaxed hidden sm:block">{day.note}</p>
          <div className="hidden sm:block"><CrowdBar share={share} /></div>
        </div>
        <div className="col-span-2 flex flex-col gap-4 sm:hidden">
          <p className="text-muted leading-relaxed">{day.note}</p>
          <CrowdBar share={share} />
        </div>
        <div className="col-span-2 flex flex-wrap gap-3">
          <Button href={watchUrl(day.film)} onClick={() => playOnArrival(day.film)} className="flex-1 sm:flex-none" data-track="halloween-sheet-play" data-film={day.film}>
            <Play className="w-4 h-4" fill="currentColor" aria-hidden="true" /> Play
          </Button>
          <SeenButton seen={seen} onClick={() => onToggle(day.film)} />
        </div>
      </div>
    </dialog>
  );
}
