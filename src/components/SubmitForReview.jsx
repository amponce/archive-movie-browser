import React, { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button';
import { api, readProfile } from '../services/profile';

const PROBLEM = {
  'too-few': 'Add at least 5 films to submit.',
  flagged: "This channel has films that can't be featured. It still works by link.",
  hidden: 'This channel cannot be submitted.',
};
const SHOWN = { submitted: 'In review.', featured: 'Featured.' };

export default function SubmitForReview({ channel, onChange }) {
  const [agreeing, setAgreeing] = useState(false);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const agreeText = useRef(null);
  const box = useRef(null);
  const statusLine = useRef(null);
  const focusStatus = useRef(false);
  const profile = readProfile();

  useEffect(() => { if (agreeing) agreeText.current?.focus(); }, [agreeing]);
  useEffect(() => {
    if (channel.status !== 'unlisted' && focusStatus.current) { focusStatus.current = false; statusLine.current?.focus(); }
  }, [channel.status]);

  if (channel.status !== 'unlisted') return <p ref={statusLine} tabIndex={-1} className="mt-6 text-sm opacity-80">{SHOWN[channel.status] || 'Public.'}</p>;
  const flagged = channel.films.some(f => f.flagged);
  const tooFew = channel.films.length < 5;
  const submit = async () => {
    setBusy(true); setMessage(null);
    try {
      const res = await api(`/api/channel/${channel.id}/submit`, { method: 'POST', profile });
      if (res.status === 204) { focusStatus.current = true; setMessage(null); await onChange(); return; }
      const { problem } = await res.json().catch(() => ({}));
      if (problem === 'not-agreed') { setAgreeing(true); return; }
      setMessage(PROBLEM[problem] || 'Could not submit. Try again.');
    } catch { setMessage('Could not submit. Try again.'); } finally { setBusy(false); }
  };
  const agree = async () => {
    setBusy(true); setMessage(null);
    try {
      const res = await api(`/api/profile/${profile.id}`, { method: 'PATCH', profile, body: { agreed: true } });
      if (!res.ok) throw new Error('agree');
    } catch { setMessage('Could not save. Try again.'); setBusy(false); return; }
    setAgreeing(false);
    await submit();
  };
  const cancel = () => { setAgreeing(false); setMessage(null); setTimeout(() => box.current?.querySelector('button')?.focus(), 0); };
  const note = message || (tooFew ? PROBLEM['too-few'] : flagged ? PROBLEM.flagged : null);
  return (
    <div ref={box} className="mt-8 border border-line p-4">
      {agreeing ? (
        <>
          <p ref={agreeText} tabIndex={-1}>Channels are collections of films, not adult content. Anything can be hidden by the mods. A featured channel may appear on the TV guide with your display name.</p>
          <div className="flex gap-3 mt-3"><Button onClick={agree} disabled={busy}>I agree, submit</Button><button type="button" className="nav-link" onClick={cancel}>Cancel</button></div>
          {message && <p role="status" className="text-sm mt-2">{message}</p>}
        </>
      ) : (
        <>
          <Button onClick={submit} disabled={tooFew || busy} aria-describedby={note ? 'submit-note' : undefined}>Submit for review</Button>
          {note && <p id="submit-note" role="status" className="text-sm mt-2">{note}</p>}
        </>
      )}
    </div>
  );
}
