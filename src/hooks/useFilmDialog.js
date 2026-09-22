import { useEffect, useRef } from 'react';

// The film page is a native <dialog> with one history entry. This hook holds the rules that
// make it behave: focus goes in and comes back out (#94), Tab stays inside, the page behind
// does not scroll, Back, Escape and the close button all do the same thing, and moving to a
// related film replaces the history entry instead of adding one.
export default function useFilmDialog({ dialogRef, backButtonRef, identifier, onClose }) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const hasRenderedIdentifierRef = useRef(false);

  // A native modal keeps background controls inert, including when focus enters the embedded
  // player. Keep one focus session across related films.
  useEffect(() => {
    const opener = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    backButtonRef.current.focus({ preventScroll: true });
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // Selecting a related film can remove the focused card from the dialog
  useEffect(() => {
    if (!dialogRef.current.contains(document.activeElement)) backButtonRef.current.focus({ preventScroll: true });
  }, [identifier]);

  // Keep the page fixed while the overlay is up, and give this overlay session one history
  // entry that the browser can return from.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!window.history.state?.movieDetail) {
      // A shared URL is already a detail URL. Make its underlying history entry the browse
      // page so closing the overlay also clears the hash.
      if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
      window.history.pushState({ movieDetail: true, identifier }, '', `#${encodeURIComponent(identifier)}`);
    }
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  // Related films reuse this overlay: replace its one history entry rather than add one each
  useEffect(() => {
    if (!hasRenderedIdentifierRef.current) { hasRenderedIdentifierRef.current = true; return; }
    window.history.replaceState({ movieDetail: true, identifier }, '', `#${encodeURIComponent(identifier)}`);
  }, [identifier]);

  // Closing always goes through history, so Back, Escape and the button behave the same
  useEffect(() => {
    const handlePopState = () => onCloseRef.current();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Native modality makes the background inert; wrap the endpoints too so Tab never leaves
  // for the browser toolbar
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      const controls = [...dialog.querySelectorAll('button, a[href], input, select, textarea, iframe, video[controls], [tabindex]')]
        .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
