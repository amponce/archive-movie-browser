import React, { useState, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import useProfile from '../hooks/useProfile';
import { ensureProfile, api } from '../services/profile';
import { readLast, writeLast } from '../services/lastChannel';

const MAX_FILMS = 40;
const SIZES = { overlay: 'p-1.5', inline: 'p-3' };

// One add at a time per channel in this tab, so two quick adds cannot overwrite each other.
const queues = new Map();
const serial = (id, fn) => {
  const next = (queues.get(id) || Promise.resolve()).catch(() => {}).then(fn);
  queues.set(id, next);
  next.catch(() => {}).then(() => { if (queues.get(id) === next) queues.delete(id); });
  return next;
};

// Returns 'added', 'already', 'full' or 'failed'.
async function addFilm(profile, channelId, film) {
  const res = await api(`/api/channel/${channelId}`, { profile });
  if (!res.ok) return 'failed';
  const current = await res.json();
  if (current.films.some(f => f.film === film)) return 'already';
  if (current.films.length >= MAX_FILMS) return 'full';
  const films = [...current.films.map(({ film: id, note }) => ({ film: id, note })), { film }];
  const patch = await api(`/api/channel/${channelId}`, { method: 'PATCH', profile, body: { films } });
  return patch.ok ? 'added' : 'failed';
}

export default function AddToChannel({ film, variant = 'overlay', className = '' }) {
  const { data, refresh } = useProfile();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [status, setStatus] = useState(null);
  const [alignLeft, setAlignLeft] = useState(false);
  const root = useRef(null);
  const button = useRef(null);
  const last = readLast();
  const channels = [...(data?.channels || [])].sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : 0));

  useEffect(() => {
    if (!status) return undefined;
    const t = setTimeout(() => setStatus(null), 3000);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = e => { if (root.current && !root.current.contains(e.target)) { setOpen(false); setNaming(false); } };
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); setNaming(false); button.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true); };
  }, [open]);

  const close = () => { setOpen(false); setNaming(false); };

  const pick = async (channel) => {
    close();
    try {
      const profile = await ensureProfile();
      const result = await serial(channel.id, () => addFilm(profile, channel.id, film));
      if (result !== 'failed') writeLast(channel.id);
      const reviewed = channel.status === 'public' || channel.status === 'featured';
      setStatus(result === 'added' ? `Added to ${channel.name}${reviewed ? '. It will be reviewed again.' : ''}` : result === 'already' ? `Added to ${channel.name}` : result === 'full' ? 'That channel is full' : 'Could not add');
    } catch {
      setStatus('Could not add');
    }
    refresh();
  };

  const create = async (name) => {
    close();
    try {
      const profile = await ensureProfile();
      const res = await api('/api/channel', { method: 'POST', profile, body: { name, films: [{ film }] } });
      if (res.ok) {
        const { id } = await res.json();
        writeLast(id);
        setStatus(`Added to ${name}`);
      } else {
        setStatus(res.status === 409 ? 'You have too many channels' : 'Could not add');
      }
    } catch {
      setStatus('Could not add');
    }
    refresh();
  };

  return (
    <div ref={root} className={`relative ${className}`} onClick={e => e.stopPropagation()}>
      <button ref={button} type="button" aria-label="Add to a channel" aria-expanded={open} data-track="add-to-channel"
        className={`${SIZES[variant] || SIZES.overlay} rounded-full bg-ink/70 hover:bg-ink text-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal`}
        onClick={() => {
          if (open) { close(); return; }
          const r = button.current.getBoundingClientRect();
          setAlignLeft(r.right - 232 < 8 && r.left + 232 <= window.innerWidth - 8);
          setOpen(true);
        }}>
        <Plus size={16} />
      </button>
      {open && (
        <div className={`absolute ${alignLeft ? 'left-0' : 'right-0'} mt-1 w-56 bg-ink border border-line z-30 text-sm text-bone`}>
          {channels.map(c => (
            <button key={c.id} type="button" className="block w-full text-left px-3 py-2 hover:bg-line focus-visible:outline-none focus-visible:bg-line truncate" onClick={() => pick(c)}>{c.name}</button>
          ))}
          {naming
            ? (
              <form className="p-2" onSubmit={e => { e.preventDefault(); const v = e.currentTarget.elements.name.value.trim(); if (v) create(v); }}>
                <input name="name" autoFocus maxLength={80} placeholder="Channel name" aria-label="Channel name" className="w-full bg-transparent border border-line px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal" />
              </form>
            )
            : <button type="button" className="block w-full text-left px-3 py-2 hover:bg-line focus-visible:outline-none focus-visible:bg-line text-signal" onClick={() => setNaming(true)}>New channel…</button>}
        </div>
      )}
      <span role="status" title={status || undefined} className={`absolute ${alignLeft ? 'left-0' : 'right-0'} top-full mt-1 w-max max-w-[14rem] whitespace-normal break-words text-xs text-bone bg-ink z-30 ${status ? 'border border-line px-2 py-1' : ''}`}>{status}</span>
    </div>
  );
}
