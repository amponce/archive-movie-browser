import React, { useState } from 'react';
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
  const profile = readProfile();
  if (channel.status !== 'unlisted') return <p className="mt-6 text-sm opacity-80">{SHOWN[channel.status] || 'Public.'}</p>;
  const flagged = channel.films.filter(f => f.flagged).length;
  const reason = channel.films.length < 5 ? PROBLEM['too-few'] : flagged ? PROBLEM.flagged : null;
  const submit = async () => {
    try {
      const res = await api(`/api/channel/${channel.id}/submit`, { method: 'POST', profile });
      if (res.status === 204) { setMessage('Submitted. If the mods like it, it will be featured.'); onChange(); return; }
      const { problem } = await res.json().catch(() => ({}));
      if (problem === 'not-agreed') { setAgreeing(true); return; }
      setMessage(PROBLEM[problem] || 'Could not submit.');
    } catch { setMessage('Could not submit.'); }
  };
  const agree = async () => {
    try {
      await api(`/api/profile/${profile.id}`, { method: 'PATCH', profile, body: { agreed: true } });
    } catch { setMessage('Could not submit.'); return; }
    setAgreeing(false);
    submit();
  };
  return (
    <div className="mt-8 border border-line p-4">
      {agreeing ? (
        <>
          <p>Channels are collections of films, not adult content. Anything can be hidden by the mods. A featured channel may appear on the TV guide with your display name.</p>
          <div className="flex gap-3 mt-3"><Button onClick={agree}>I agree, submit</Button><button type="button" className="nav-link" onClick={() => setAgreeing(false)}>Cancel</button></div>
        </>
      ) : (
        <>
          <Button onClick={submit} disabled={!!reason}>Submit for review</Button>
          {(reason || message) && <p className="text-sm mt-2">{message || reason}</p>}
        </>
      )}
    </div>
  );
}
