import { useEffect, useRef } from 'react';
import { watchReporter } from '../services/analytics';

// Minutes watched for one viewing (a film, or a channel on the set). Returns a ref to a reporter:
// call .add(seconds) as playback advances and .flush() on pause. It also reports when the tab is
// hidden, the page goes away, or the viewing changes (`key`).
export default function useWatchReport(where, subject, key) {
  const reporter = useRef(watchReporter(where, subject));
  useEffect(() => {
    const r = watchReporter(where, subject);
    reporter.current = r;
    const onHidden = () => { if (document.visibilityState === 'hidden') r.flush(); };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', r.flush);
    return () => {
      r.flush();
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', r.flush);
    };
  }, [key]);
  return reporter;
}
