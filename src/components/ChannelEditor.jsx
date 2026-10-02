import React, { useState } from 'react';
import { api, readProfile } from '../services/profile';

const MAX_FILMS = 40;
const field = 'w-full bg-transparent border border-line px-2 py-1 text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal';

// The owner's controls on a channel page. Each change is saved as it is made: text on blur,
// order and removals at once. Only fields that changed are sent.
export default function ChannelEditor({ channel, titles = {}, onChange }) {
  const [films, setFilms] = useState(channel.films);
  const [drag, setDrag] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState(null);
  const profile = readProfile();

  const save = async (body) => {
    setStatus('Saving…');
    try {
      const res = await api(`/api/channel/${channel.id}`, { method: 'PATCH', profile, body });
      setStatus(res.ok ? 'Saved' : 'Could not save');
    } catch {
      setStatus('Could not save');
    }
    onChange();
  };
  const saveFilms = (next) => { setFilms(next); save({ films: next.slice(0, MAX_FILMS).map(({ film, note }) => ({ film, note })) }); };
  const move = (from, to) => { const next = [...films]; const [x] = next.splice(from, 1); next.splice(to, 0, x); saveFilms(next); };
  const changed = (value, stored) => value.trim() !== (stored || '');
  const remove = async () => {
    const res = await api(`/api/channel/${channel.id}`, { method: 'DELETE', profile });
    if (res.ok) window.location.href = `/u/${profile.id}`;
    else { setConfirm(false); setStatus('Could not delete'); }
  };

  return (
    <div className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="label">Name</span>
        <input defaultValue={channel.name} maxLength={80} className={`${field} text-xl`}
          onBlur={e => changed(e.target.value, channel.name) && save({ name: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Description</span>
        <textarea defaultValue={channel.description} maxLength={500} rows={3} className={field}
          onBlur={e => changed(e.target.value, channel.description) && save({ description: e.target.value })} />
      </label>
      <ol className="flex flex-col gap-2" aria-label="Films, in playing order">
        {films.map((f, i) => (
          <li key={f.film} draggable
            onDragStart={e => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (drag !== null && drag !== i) move(drag, i); setDrag(null); }}
            onDragEnd={() => setDrag(null)}
            className={`flex flex-wrap sm:flex-nowrap items-center gap-2 border p-2 ${drag === i ? 'border-signal' : 'border-line'}`}>
            <span aria-hidden="true" className="cursor-grab text-dim select-none">⋮⋮</span>
            <span className="flex-1 min-w-0 truncate text-bone">{titles[f.film] || f.film}</span>
            <input defaultValue={f.note || ''} maxLength={280} placeholder="Why this film?" aria-label={`Note for ${titles[f.film] || f.film}`}
              className={`${field} sm:flex-1 text-sm`}
              onBlur={e => changed(e.target.value, f.note) && saveFilms(films.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
            <button type="button" className="btn-ghost px-3" aria-label={`Move ${titles[f.film] || f.film} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
            <button type="button" className="btn-ghost px-3" aria-label={`Remove ${titles[f.film] || f.film}`} onClick={() => saveFilms(films.filter((_, j) => j !== i))}>✕</button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {confirm
          ? <span className="flex items-center gap-3">Delete this channel? <button type="button" className="text-signal underline" onClick={remove}>Yes, delete</button> <button type="button" className="underline" onClick={() => setConfirm(false)}>No</button></span>
          : <button type="button" className="nav-link hover:text-signal" onClick={() => setConfirm(true)}>Delete channel</button>}
        <span role="status" className="text-muted">{status}</span>
      </div>
    </div>
  );
}
