import { useEffect, useRef } from 'react';
import { watchReporter } from '../services/analytics';

// Minutes watched for one viewing (a film, or a channel on the set). Returns a ref to a reporter:
// call .add(seconds) as playback advances and .flush() on pause. It also reports when the tab is
// hidden, the page goes away, or the viewing changes (`key`).
export default function useWatchReport(where, subject, key, more) {
  const reporter = useRef(watchReporter(where, subject, undefined, more));
  useEffect(() => {
    const r = watchReporter(where, subject, undefined, more);
    reporter.current = r;
    const onHidden = () => { if (document.visibilityState === 'hidden') r.flush(); };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', r.flush);
    // Long viewings report every five minutes, so minutes land in the hour they were watched
    const timer = setInterval(() => r.flush(), 300_000);
    return () => {
      clearInterval(timer);
      r.flush();
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', r.flush);
    };
  }, [key]);
  return reporter;
}
