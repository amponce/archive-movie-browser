import React, { useRef, useState } from 'react';
import { GripVertical, ArrowUp, X } from 'lucide-react';
import { api, readProfile } from '../services/profile';
import { serial } from '../services/serial';

const MAX_FILMS = 40;
const filmsKey = list => list.map(f => f.film).join('\n');
const RELOADED = 'This channel changed in another tab — reloaded';
const field = 'w-full bg-transparent border border-line px-2 py-1 text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal';

// The owner's controls on a channel page. Each change is saved as it is made: text on blur,
// order and removals at once. Only fields that changed are sent. Saves go one at a time, and
// only the last one queued reports and reloads.
// The film list is sent whole, so the stored list is read again before each film save: another
// tab, window or device may have added a film since. If it changed, the editor takes the stored
// list instead of saving over it, and says so.
export default function ChannelEditor({ channel, titles = {}, onChange }) {
  const [films, setFilms] = useState(channel.films);
  const [drag, setDrag] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState(null);
  const queued = useRef({ last: 0, failed: false, reloaded: false });
  const stored = useRef(filmsKey(channel.films)); // the list as last read or saved here
  const edits = useRef(0); // film saves made before a reload are dropped
  const profile = readProfile();

  // True when this film save may go ahead
  const current = async (edit) => {
    if (edit !== edits.current) return false;
    const res = await api(`/api/channel/${channel.id}`, { profile });
    const fresh = res.ok ? await res.json() : null;
    if (!fresh || filmsKey(fresh.films) === stored.current) return true;
    edits.current++;
    stored.current = filmsKey(fresh.films);
    setFilms(fresh.films);
    queued.current.reloaded = true;
    return false;
  };

  const save = (body, edit) => {
    const n = ++queued.current.last;
    setStatus('Saving…');
    serial(channel.id, async () => {
      try {
        if (edit === undefined || await current(edit)) {
          const res = await api(`/api/channel/${channel.id}`, { method: 'PATCH', profile, body });
          if (!res.ok) queued.current.failed = true;
          else if (body.films) stored.current = filmsKey(body.films);
        }
      } catch {
        queued.current.failed = true;
      }
      if (n !== queued.current.last) return;
      setStatus(queued.current.reloaded ? RELOADED : queued.current.failed ? 'Could not save' : 'Saved');
      queued.current.failed = false;
      queued.current.reloaded = false;
      onChange();
    });
  };
  const saveFilms = (next) => { setFilms(next); save({ films: next.slice(0, MAX_FILMS).map(({ film, note }) => ({ film, note })) }, edits.current); };
  const move = (from, to) => { const next = [...films]; const [x] = next.splice(from, 1); next.splice(to, 0, x); saveFilms(next); };
  const changed = (value, stored) => value.trim() !== (stored || '');
  const remove = async () => {
    try {
      const res = await serial(channel.id, () => api(`/api/channel/${channel.id}`, { method: 'DELETE', profile }));
      if (res.ok) { window.location.href = `/u/${profile.id}`; return; }
    } catch { /* falls through */ }
    setConfirm(false);
    setStatus('Could not delete');
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
            <GripVertical size={16} aria-hidden="true" className="cursor-grab text-dim shrink-0" />
            <span className="flex-1 min-w-0 truncate text-bone">{titles[f.film] || f.film}</span>
            <input defaultValue={f.note || ''} maxLength={280} placeholder="Why this film?" aria-label={`Note for ${titles[f.film] || f.film}`}
              className={`${field} sm:flex-1 text-sm`}
              onBlur={e => changed(e.target.value, f.note) && saveFilms(films.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} />
            <button type="button" className="btn-ghost px-3" aria-label={`Move ${titles[f.film] || f.film} up`} disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp size={16} aria-hidden="true" /></button>
            <button type="button" className="btn-ghost px-3" aria-label={`Remove ${titles[f.film] || f.film}`} onClick={() => saveFilms(films.filter((_, j) => j !== i))}><X size={16} aria-hidden="true" /></button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {confirm
          ? <span className="flex items-center gap-3">Delete this channel? <button type="button" className="text-signal underline" onClick={remove}>Yes, delete</button> <button type="button" className="underline" autoFocus onClick={() => setConfirm(false)}>No</button></span>
          : <button type="button" className="nav-link hover:text-signal" onClick={() => setConfirm(true)}>Delete channel</button>}
        <span role="status" className="text-muted">{status}</span>
      </div>
    </div>
  );
}
