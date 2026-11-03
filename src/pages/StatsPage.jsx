import SiteHeader from '../layout/SiteHeader';
import React, { Fragment, useEffect, useState } from 'react';

const KEY = 'stats-key';
const MARK = '#c08a10'; // single series; passes the dark-surface lightness and contrast checks
const EVENTS = ['Page view', 'Click', 'Film opened', 'Play', 'Watched 10 minutes', 'Seconds watched', 'Search', 'Filter', 'Load more'];
const STAGES = ['visited', 'clicked', 'played', 'tuned in', 'watched 1+ min', 'watched 10+ min', 'watched 30+ min'];
const FILM_BOARDS = ['played', 'watched', 'opened', 'minutes', 'tv-links'];
const BOARDS = [
  ['minutes', 'Minutes watched, by film'], ['channel-minutes', 'Minutes watched, by channel'], ['clicks', 'What people click'],
  ['tuned', 'Channels tuned to'], ['stayed', 'Channels watched 10+ minutes'], ['played', 'Films played'], ['watched', 'Watched 10+ minutes'], ['opened', 'Films opened'], ['searches', 'Searches'], ['filters', 'Filters used'],
  ['no-results', 'Searches that found nothing'], ['screens', 'Plays, by screen'],
  ['tv-links', 'Film links followed by players'], ['tv-apps', 'Players following film links'],
  ['referrers', 'Where visitors came from'], ['pages', 'Pages'], ['players', 'Player used'], ['played-from', 'Plays, by list, channel or row'], ['banner', 'MCP banner'],
];
const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const NEW_SINCE = '2026-10-27'; // when the per-film columns after "Of its length" began counting
const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '');

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
const sum = (days, name) => days.reduce((total, day) => total + (day.events[name] || 0), 0);
const readKey = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
// A key pasted from a .env file often arrives with quotes or a newline; the server wants only the value
export const cleanKey = (text) => String(text || '').trim().replace(/^["']|["']$/g, '').trim();

async function fetchStats(key, query = '') {
  const response = await fetch(`/api/stats${query}`, { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
  if (!response.ok) {
    const said = await response.json().then(body => body.error, () => null);
    throw new Error(response.status === 404 ? 'That key does not match. It is the whole STATS_TOKEN value, no quotes around it.' : said || `The stats could not be loaded (${response.status}).`);
  }
  return response.json();
}

const Panel = ({ title, note, children }) => (
  <section className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
    <h2 className="font-semibold mb-3">{title} {note && <span className="text-gray-400 font-normal">{note}</span>}</h2>
    {children}
  </section>
);

// Visitors per day: one series, thin bars with a 2px gap, rounded at the data end only
function DailyChart({ days }) {
  const max = Math.max(1, ...days.map(day => day.visitors));
  return (
    <>
      <div role="img" aria-label="Visitors per day for the last 30 days. The same numbers are in the table below." className="flex items-end gap-[2px] h-36 border-b border-gray-700">
        {days.map(day => (
          <div key={day.day} tabIndex={0} className="group relative flex-1 h-full flex items-end justify-center focus:outline-none">
            <div className="w-full max-w-[24px] rounded-t group-hover:brightness-125 group-focus-visible:brightness-125" style={{ height: `${(day.visitors / max) * 100}%`, background: MARK }} />
            <span className="hidden group-hover:block group-focus-visible:block absolute bottom-full left-1/2 -translate-x-1/2 z-10 whitespace-nowrap bg-gray-950 border border-gray-700 rounded px-2 py-0.5 text-xs pointer-events-none">
              {day.day}: {fmt(day.visitors)} visitors
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1.5"><span>{days[0].day}</span><span>{days.at(-1).day}</span></div>
    </>
  );
}

// How far visits got, per day: each stage counts distinct visits, and the share is of that
// day's visits. A visit is one browser tab, counted without keeping its id.
function Funnel({ days }) {
  if (!days?.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="text-sm w-full">
        <thead><tr className="text-gray-400">{['Day', ...STAGES].map(h => <th key={h} className="font-medium text-right first:text-left pr-4 py-1 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>
          {[...days].reverse().map(day => (
            <tr key={day.day} className="border-t border-gray-700 tabular-nums">
              <td className="pr-4 py-1">{day.day}</td>
              {STAGES.map((stage, i) => (
                <td key={stage} className="text-right pr-4">
                  {fmt(day[stage])}{i > 0 && day.visited > 0 && <span className="text-gray-500"> {Math.round((day[stage] / day.visited) * 100)}%</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A film by its name, linking to it; the Archive.org identifier is the fallback and the tooltip
const Film = ({ id, titles }) => <a href={`/#${encodeURIComponent(id)}`} title={id} className="hover:text-yellow-400 hover:underline">{titles[id] || id}</a>;

function Board({ rows, films, titles }) {
  if (!rows.length) return <p className="text-gray-400">Nothing yet this month.</p>;
  const top = rows[0][1] || 1;
  return (
    <table className="w-full">
      <tbody>
        {rows.map(([label, count, people]) => (
          <tr key={label} className="border-b border-gray-700">
            <td className="py-1.5 pr-3 max-w-0 w-[60%] truncate" title={label}>{films ? <Film id={label} titles={titles} /> : label}</td>
            <td><div className="h-2 rounded-r min-w-[2px]" style={{ width: `${(count / top) * 100}%`, background: MARK }} /></td>
            <td className="w-14 text-right tabular-nums">{fmt(count)}</td>
            {people !== undefined && <td className="w-20 text-right tabular-nums text-gray-400" title="different visits">{fmt(people)} ppl</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// What just happened, newest first: the quickest way to see that something was counted
function Latest({ events, titles, day = false }) {
  if (!events.length) return <p className="text-gray-400">Nothing yet.</p>;
  const when = at => new Date(at).toLocaleString(undefined, day ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { timeStyle: 'medium' });
  const detail = ({ name, data }) => name === 'Watched' ? <>{Math.round(data.seconds / 60)} min of {data.film ? <Film id={data.film} titles={titles} /> : `channel ${data.channel}`} ({Math.round(data.total / 60)} min so far)</>
    : name === 'Click' ? <>{data.target}{data.film && <> · <Film id={data.film} titles={titles} /></>}</>
    : data.film ? <Film id={data.film} titles={titles} />
    : name === 'Search' ? (data.query ? `“${data.query}”` : 'a pasted link')
    : name === 'Filter' ? `${data.type}: ${data.value}`
    : name === 'Page view' ? `${data.path}${data.referrer ? ` from ${data.referrer}` : ''}`
    : data.action || data.player || '';
  return (
    <table className="w-full text-sm">
      <tbody>
        {events.map((event, i) => (
          <tr key={i} className="border-b border-gray-700">
            <td className="py-1 pr-3 text-gray-400 tabular-nums whitespace-nowrap">{when(event.at)}</td>
            <td className="py-1 pr-3 whitespace-nowrap">{event.name}{event.data.player ? ` (${event.data.player} player)` : ''}</td>
            <td className="py-1 max-w-0 w-[55%] truncate">{detail(event)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Per film: how often it was opened and played, how much of it was watched, and signs of a bad copy
function FilmsTable({ films, titles }) {
  if (!films?.length) return <p className="text-gray-400">Nothing yet this month.</p>;
  const rows = [...films].sort((a, b) => b.played - a.played || b.opened - a.opened);
  // A column whose counter has nothing yet this month stays blank rather than reading 0% or 100%
  const has = key => films.some(f => (key === 'reach' ? f.reach.some(Boolean) : f[key] > 0));
  const counting = { min1: has('min1'), archive: has('archive') || has('reach'), copyFailed: has('copyFailed') || has('reach'), subsMinutes: has('subsMinutes') || has('reach'), reach: has('reach') };
  const heads = [['Film'], ['Opened'], ['Played'], ['Min per play'], ['Of its length', 'minutes watched over plays × length'], ['Where people stop', 'viewings that reached each tenth of the film'], ['Under 1 min', 'plays that did not reach a minute'], ['Archive player', 'plays that fell back to Archive.org’s player'], ['Bad copies', 'files that would not play'], ['Subtitles', 'share of minutes with subtitles on']];
  return (
    <div className="overflow-x-auto">
      <table className="text-sm w-full">
        <thead><tr className="text-gray-400">{heads.map(([h, tip]) => <th key={h} title={tip} className={th}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map(f => {
            const top = Math.max(1, ...f.reach);
            return (
              <tr key={f.film} className="border-t border-gray-700 tabular-nums">
                <td className="py-1 pr-4 max-w-[16rem] truncate"><Film id={f.film} titles={titles} /></td>
                <td className="text-right pr-4">{fmt(f.opened)}</td>
                <td className="text-right pr-4">{fmt(f.played)}</td>
                <td className="text-right pr-4">{f.played ? fmt(f.minutes / f.played) : ''}</td>
                <td className="text-right pr-4">{f.length ? pct(f.minutes, f.played * f.length) : ''}</td>
                <td className="py-1 pr-4">
                  {counting.reach && f.reach.some(Boolean) && (
                    <div role="img" aria-label={`Viewings reaching each tenth: ${f.reach.join(', ')}`} className="flex items-end gap-[2px] h-5 w-28">
                      {f.reach.map((n, k) => <div key={k} title={`${k * 10}%: ${fmt(n)}`} className="flex-1 rounded-t-sm min-h-px" style={{ height: `${(n / top) * 100}%`, background: MARK }} />)}
                    </div>
                  )}
                </td>
                <td className="text-right pr-4">{counting.min1 && f.played ? pct(Math.max(0, f.played - f.min1), f.played) : ''}</td>
                <td className="text-right pr-4">{counting.archive ? pct(f.archive, f.played) : ''}</td>
                <td className="text-right pr-4">{f.copyFailed ? fmt(f.copyFailed) : ''}</td>
                <td className="text-right pr-4">{counting.subsMinutes ? pct(f.subsMinutes, f.minutes) : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Share of minutes watched beside share of the films the site has, by main genre or decade
function Shares({ rows, label }) {
  if (!rows?.length) return null;
  const minutes = rows.reduce((t, r) => t + r.minutes, 0);
  const films = rows.reduce((t, r) => t + r.films, 0);
  const top = Math.max(1, ...rows.map(r => r.minutes));
  return (
    <table className="text-sm w-full">
      <thead><tr className="text-gray-400"><th className={th}>{label}</th><th className={th} /><th className={th}>Of minutes</th><th className={th}>Of films</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.label} className="border-t border-gray-700 tabular-nums">
            <td className="py-1 pr-3 whitespace-nowrap">{r.label}</td>
            <td className="w-[40%] pr-3"><div className="h-2 rounded-r min-w-[2px]" style={{ width: `${(r.minutes / top) * 100}%`, background: MARK }} /></td>
            <td className="text-right pr-4">{pct(r.minutes, minutes)}</td>
            <td className="text-right pr-4 text-gray-400">{pct(r.films, films)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Minutes watched in each hour (Pacific): one row per weekday, or per channel
function HourGrid({ rows }) {
  const max = Math.max(1, ...rows.flatMap(r => r.hours));
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead><tr className="text-gray-400"><th />{HOURS.map(h => <th key={h} className="font-normal px-[1px]">{Number(h) % 3 ? '' : h}</th>)}</tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td className="pr-2 text-gray-400 whitespace-nowrap max-w-[10rem] truncate">{r.label}</td>
              {r.hours.map((seconds, h) => (
                <td key={h} className="p-[1px]">
                  <div tabIndex={0} title={`${r.label} ${HOURS[h]}:00, ${fmt(seconds / 60)} min`} aria-label={`${r.label} ${HOURS[h]}:00, ${fmt(seconds / 60)} minutes`}
                    className="w-4 h-4 rounded-sm border border-gray-700" style={seconds ? { background: MARK, opacity: 0.15 + 0.85 * (seconds / max) } : undefined} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const weekRows = hours => WEEK.map(day => ({ label: day, hours: HOURS.map(h => hours?.[`${day} ${h}`] || 0) }));
function channelRows(channelHours) {
  const by = {};
  for (const [key, seconds] of Object.entries(channelHours || {})) {
    const at = key.lastIndexOf(' ');
    (by[key.slice(0, at)] ||= Array(24).fill(0))[Number(key.slice(at + 1))] += seconds;
  }
  return Object.entries(by).map(([label, hours]) => ({ label, hours })).sort((a, b) => b.hours.reduce((x, y) => x + y) - a.hours.reduce((x, y) => x + y)).slice(0, 15);
}

// Every search in a chosen month, loaded when asked for
const lastMonths = (month) => Array.from({ length: 13 }, (_, i) => { const d = new Date(`${month}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 7); });
function AllSearches({ month }) {
  const [chosen, setChosen] = useState(month);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const load = (m) => { setChosen(m); setRows(null); setError(''); fetchStats(readKey(), `?searches=${m}`).then(body => setRows(body.rows), problem => setError(problem.message)); };
  const shown = (rows || []).filter(([query]) => query.includes(filter.trim().toLowerCase()));
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <select aria-label="Month" value={chosen} onChange={e => load(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1">
          {lastMonths(month).map(m => <option key={m}>{m}</option>)}
        </select>
        {rows === null && !error && chosen === month && <button onClick={() => load(month)} className="border border-gray-700 rounded-md px-3 py-1 text-gray-300 hover:text-white">Show every search</button>}
        {rows && <input type="search" aria-label="Filter searches" placeholder="Filter" value={filter} onChange={e => setFilter(e.target.value)} className="flex-1 min-w-[10rem] bg-gray-800 border border-gray-700 rounded-md px-3 py-1" />}
      </div>
      {error && <p role="alert" className="text-gray-400">{error}</p>}
      {rows && (
        <>
          <p className="text-gray-400 text-sm mb-2">{fmt(rows.length)} different searches, {fmt(rows.reduce((t, r) => t + r[1], 0))} in all{filter && `; ${fmt(shown.length)} match`}</p>
          <div className="max-h-96 overflow-y-auto">
            <table className="text-sm w-full">
              <tbody>
                {shown.map(([query, count, people]) => (
                  <tr key={query} className="border-b border-gray-700 tabular-nums">
                    <td className="py-1 pr-3 break-all">{query}</td>
                    <td className="w-14 text-right">{fmt(count)}</td>
                    <td className="w-20 text-right text-gray-400" title="different visits">{people === null ? '' : `${fmt(people)} ppl`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// The whole event log, 500 at a time, newest first: filter by kind (Search for every search,
// typed as it was) and by text
const describe = ({ name, data }) => [name, data.query, data.film, data.title, data.path, data.referrer, data.channel, data.action, data.target, data.type, data.value].filter(Boolean).join(' ').toLowerCase();
function Log() {
  const [pages, setPages] = useState([]);
  const [total, setTotal] = useState(0);
  const [titles, setTitles] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('');
  const [text, setText] = useState('');
  const rows = pages.flat();
  const more = (offset) => {
    setBusy(true); setError('');
    fetchStats(readKey(), `?log=${offset}`).then(body => { setPages(p => [...p, body.rows]); setTotal(body.total); setTitles(t => ({ ...t, ...body.titles })); }, problem => setError(problem.message)).finally(() => setBusy(false));
  };
  const kinds = [...new Set(rows.map(r => r.name))].sort();
  const needle = text.trim().toLowerCase();
  const shown = rows.filter(r => (!kind || r.name === kind) && (!needle || describe(r).includes(needle) || (r.data.film && (titles[r.data.film] || '').toLowerCase().includes(needle))));
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {!rows.length && !busy && <button onClick={() => more(0)} className="border border-gray-700 rounded-md px-3 py-1 text-gray-300 hover:text-white">Show the log</button>}
        {rows.length > 0 && (
          <>
            <select aria-label="Kind" value={kind} onChange={e => setKind(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1">
              <option value="">Everything</option>
              {kinds.map(k => <option key={k}>{k}</option>)}
            </select>
            <input type="search" aria-label="Filter the log" placeholder="Filter" value={text} onChange={e => setText(e.target.value)} className="flex-1 min-w-[10rem] bg-gray-800 border border-gray-700 rounded-md px-3 py-1" />
          </>
        )}
      </div>
      {error && <p role="alert" className="text-gray-400">{error}</p>}
      {rows.length > 0 && (
        <>
          <p className="text-gray-400 text-sm mb-2">{fmt(rows.length)} of {fmt(total)} events loaded{(kind || needle) && `; ${fmt(shown.length)} match`}</p>
          <div className="max-h-[32rem] overflow-y-auto"><Latest events={shown} titles={titles} day /></div>
          {rows.length < total && <button disabled={busy} onClick={() => more(rows.length)} className="mt-3 border border-gray-700 rounded-md px-3 py-1 text-gray-300 hover:text-white disabled:opacity-50">{busy ? 'Loading…' : 'Load 500 more'}</button>}
        </>
      )}
    </div>
  );
}

const when = ms => (ms ? new Date(ms).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const whoIs = p => p.name || (p.handle && `@${p.handle}`) || p.id;

// One profile opened from the list: favourites, channels with their films and notes, changes
function ProfileDetail({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { fetchStats(readKey(), `?profile=${encodeURIComponent(id)}`).then(setData, problem => setError(problem.message)); }, [id]);
  if (error) return <p role="alert" className="text-gray-400">{error}</p>;
  if (!data) return <p className="text-gray-400">Loading…</p>;
  if (!data.profile) return <p className="text-gray-400">Gone.</p>;
  const titles = data.titles || {};
  return (
    <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(16rem,1fr))] text-sm">
      <div>
        <h4 className="text-gray-400 mb-1">Favourites ({fmt(data.favourites.length)})</h4>
        {data.favourites.length ? <ul className="space-y-0.5">{data.favourites.map(f => <li key={f.film} className="truncate"><span className="text-gray-400 tabular-nums mr-2">{when(f.created)}</span><Film id={f.film} titles={titles} /></li>)}</ul> : <p className="text-gray-400">None.</p>}
      </div>
      <div>
        <h4 className="text-gray-400 mb-1">Channels ({fmt(data.channels.length)})</h4>
        {data.channels.length ? data.channels.map(c => (
          <details key={c.id} className="mb-2" open={data.channels.length === 1}>
            <summary className="cursor-pointer"><a href={`/c/${c.id}`} className="hover:text-yellow-400 hover:underline">{c.name}</a> <span className="text-gray-400">· {c.status} · {fmt(c.films.length)} films · {when(c.updated)}</span></summary>
            {c.description && <p className="text-gray-400 my-1">{c.description}</p>}
            <ol className="list-decimal ml-5 space-y-0.5">{c.films.map(f => <li key={f.film}><Film id={f.film} titles={titles} />{f.note && <span className="text-gray-400"> — {f.note}</span>}</li>)}</ol>
          </details>
        )) : <p className="text-gray-400">None.</p>}
      </div>
      <div>
        <h4 className="text-gray-400 mb-1">Changes ({fmt(data.history.length)})</h4>
        {data.history.length ? (
          <div className="max-h-72 overflow-y-auto"><table className="w-full"><tbody>
            {data.history.map((row, i) => (
              <tr key={i} className="border-b border-gray-700"><td className="py-0.5 pr-3 text-gray-400 tabular-nums whitespace-nowrap">{when(row.at)}</td><td className="py-0.5 pr-3 whitespace-nowrap">{CHANGES[row.kind] || row.kind}</td><td className="py-0.5 pr-3 max-w-0 truncate">{row.channel || ''}</td><td className="font-mono text-gray-400">{row.net || ''}</td></tr>
            ))}
          </tbody></table></div>
        ) : <p className="text-gray-400">None.</p>}
      </div>
    </div>
  );
}

// Every profile, the most recently active first; a row opens to what that person has made
function Profiles() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [text, setText] = useState('');
  const load = () => { setError(''); fetchStats(readKey(), '?profiles').then(body => setRows(body.profiles), problem => setError(problem.message)); };
  const needle = text.trim().toLowerCase();
  const shown = (rows || []).filter(p => !needle || [p.name, p.handle, p.archive_user, p.id].some(v => (v || '').toLowerCase().includes(needle)));
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {rows === null && !error && <button onClick={load} className="border border-gray-700 rounded-md px-3 py-1 text-gray-300 hover:text-white">Show every profile</button>}
        {rows && <input type="search" aria-label="Filter profiles" placeholder="Filter" value={text} onChange={e => setText(e.target.value)} className="flex-1 min-w-[10rem] bg-gray-800 border border-gray-700 rounded-md px-3 py-1" />}
      </div>
      {error && <p role="alert" className="text-gray-400">{error}</p>}
      {rows && (
        <>
          <p className="text-gray-400 text-sm mb-2">{fmt(rows.length)} profiles{needle && `; ${fmt(shown.length)} match`}</p>
          <div className="max-h-[40rem] overflow-y-auto">
            <table className="text-sm w-full">
              <thead><tr className="text-gray-400">{['Profile', 'Archive.org', 'Channels', 'Hearts', 'Saved', 'Made', 'Last change'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody>
                {shown.map(p => (
                  <Fragment key={p.id}>
                    <tr className="border-t border-gray-700 tabular-nums">
                      <td className="pr-4 py-1 max-w-0 w-[30%] truncate">
                        <button onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id} className="hover:text-yellow-400 text-left">{open === p.id ? '▾' : '▸'} {whoIs(p)}</button>
                        {p.hidden ? <span className="text-gray-400"> · hidden</span> : <a href={`/u/${p.id}`} className="text-gray-400 hover:text-yellow-400 ml-2">page</a>}
                      </td>
                      <td className="text-right pr-4 truncate">{p.archive_user}</td>
                      <td className="text-right pr-4">{fmt(p.channels)}</td>
                      <td className="text-right pr-4">{fmt(p.hearts)}</td>
                      <td className="text-right pr-4">{fmt(p.saved)}</td>
                      <td className="text-right pr-4 whitespace-nowrap">{when(p.created)}</td>
                      <td className="text-right pr-4 whitespace-nowrap">{when(p.last)}</td>
                    </tr>
                    {open === p.id && <tr><td colSpan={7} className="py-3 pl-4 border-l-2 border-gray-700"><ProfileDetail id={p.id} /></td></tr>}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const CHANGES = { 'profile-created': 'Profile created', 'profile-edited': 'Profile edited', 'profile-merged': 'Profile merged', 'channel-created': 'Channel created', 'channel-edited': 'Channel edited', 'channel-deleted': 'Channel deleted', 'channel-submitted': 'Channel submitted' };
const th = 'font-medium text-right first:text-left pr-4 py-1 whitespace-nowrap';

// Changes to profiles and channels: per day, networks (by tag) with several new profiles, latest
function Community({ community }) {
  const { days, networks, latest } = community;
  const who = row => (row.kind.startsWith('channel') ? row.channel : row.name || (row.handle && `@${row.handle}`)) || '';
  return (
    <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(19rem,1fr))]">
      <div className="overflow-x-auto">
        <table className="text-sm w-full">
          <thead><tr className="text-gray-400">{['Day', 'Profiles', 'Channels', 'Channel edits', 'Channels deleted'].map(h => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {[...days].reverse().map(day => (
              <tr key={day.day} className="border-t border-gray-700 tabular-nums">
                <td className="pr-4 py-1 whitespace-nowrap">{day.day}</td>
                {['profiles', 'channels', 'edits', 'deleted'].map(key => <td key={key} className="text-right pr-4">{fmt(day[key])}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-5">
        <div>
          <h3 className="text-sm text-gray-400 mb-1">Networks with several new profiles (7 days)</h3>
          {networks.length ? (
            <table className="text-sm w-full">
              <tbody>
                {networks.map(row => (
                  <tr key={row.net} className="border-b border-gray-700 tabular-nums">
                    <td className="py-1 pr-3 font-mono">{row.net.slice(0, 6)}</td>
                    <td className="text-right">{fmt(row.profiles)} profiles</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-gray-400 text-sm">None.</p>}
        </div>
        <div>
          <h3 className="text-sm text-gray-400 mb-1">Latest changes</h3>
          {latest.length ? (
            <div className="max-h-72 overflow-y-auto">
              <table className="text-sm w-full">
                <tbody>
                  {latest.map((row, i) => (
                    <tr key={i} className="border-b border-gray-700">
                      <td className="py-1 pr-3 text-gray-400 tabular-nums whitespace-nowrap">{new Date(row.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                      <td className="py-1 pr-3 whitespace-nowrap">{CHANGES[row.kind] || row.kind}</td>
                      <td className="py-1 pr-3 max-w-0 w-[45%] truncate" title={who(row)}>{who(row)}</td>
                      <td className="py-1 font-mono text-gray-400">{row.net || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-gray-400 text-sm">Nothing yet.</p>}
        </div>
      </div>
    </div>
  );
}

// The maintainer's view of our own usage counts (api/stats.js). The key is checked by the
// server; here it is only remembered on this device.
export default function StatsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [entered, setEntered] = useState('');

  const [updated, setUpdated] = useState(null);

  const load = (key) => fetchStats(key)
    .then(stats => { try { localStorage.setItem(KEY, key); } catch { /* private mode */ } setData(stats); setUpdated(new Date()); setError(''); })
    .catch(problem => setError(problem.message));

  useEffect(() => {
    document.title = 'Stats | Orphaned Films';
    if (readKey()) load(readKey());
    // Keep the numbers current while the page is open and in view
    const timer = setInterval(() => { if (readKey() && !document.hidden) load(readKey()); }, 300_000); // each read is ~175 database commands
    return () => clearInterval(timer);
  }, []);

  const forget = () => { try { localStorage.removeItem(KEY); } catch { /* private mode */ } setData(null); setEntered(''); };
  const week = data?.days.slice(-7) || [];
  const tiles = data && [
    [data.activeNow ?? 0, 'active in the last 10 minutes'], [data.days.at(-1).visitors, 'visitors today'], [data.visitorsThisMonth, 'visitors this month'], [sum(week, 'Page view'), 'page views, 7 days'],
    [sum(week, 'Film opened'), 'films opened, 7 days'], [sum(week, 'Seconds watched') / 60, 'minutes watched, 7 days'], [sum(week, 'Play'), 'plays, 7 days'], [sum(week, 'Watched 10 minutes'), 'watched 10+ min, 7 days'], [sum(week, 'Search'), 'searches, 7 days'],
  ];

  return (
    <div className="min-h-screen text-muted">
      <SiteHeader current="/stats" />
      <div className="max-w-6xl mx-auto p-5">
        <header className="flex flex-wrap justify-between items-baseline gap-4 mb-6">
          <h1 className="display text-3xl text-bone">Usage</h1>
          <span className="flex items-center gap-3 text-sm">
            {data && <span className="text-gray-400">Updated {updated?.toLocaleTimeString()}</span>}
            {data && <button onClick={() => load(readKey())} className="border border-gray-700 rounded-md px-3 py-1 text-gray-300 hover:text-white">Refresh</button>}
            {data && <button onClick={forget} className="border border-gray-700 rounded-md px-3 py-1 text-gray-400 hover:text-white">Forget key on this device</button>}
          </span>
        </header>

        {!data && (
          <section>
            <p>This page is for the maintainer. Paste the stats key to see the numbers.</p>
            <form className="flex gap-2 max-w-md mt-4" onSubmit={(event) => { event.preventDefault(); load(cleanKey(entered)); }}>
              <input
                type="password" autoComplete="off" aria-label="Stats key" placeholder="Stats key" value={entered} onChange={(e) => setEntered(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-yellow-400"
              />
              <button className="bg-yellow-400 text-gray-900 font-semibold rounded-md px-4">Show stats</button>
            </form>
            <p role="alert" className="text-gray-400 mt-3">{error}</p>
          </section>
        )}

        {data && (
          <main className="space-y-5">
            <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
              {tiles.map(([value, label]) => (
                <div key={label} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
                  <div className="text-3xl font-bold tabular-nums leading-tight">{fmt(value)}</div>
                  <div className="text-sm text-gray-400">{label}</div>
                </div>
              ))}
            </div>

            <Panel title="How far visits got" note="(distinct visits per stage, last 14 days, Pacific time)">
              <Funnel days={data.funnel} />
            </Panel>

            <Panel title="Visitors per day" note="(estimated distinct people, last 30 days, Pacific time)">
              <DailyChart days={data.days} />
              <details className="mt-3">
                <summary className="cursor-pointer text-gray-400">Daily numbers as a table</summary>
                <div className="overflow-x-auto">
                  <table className="text-sm mt-2">
                    <thead><tr className="text-gray-400">{['Day', 'Visitors', ...EVENTS].map(h => <th key={h} className="font-medium text-right first:text-left pr-4 py-1">{h}</th>)}</tr></thead>
                    <tbody>
                      {[...data.days].reverse().map(day => (
                        <tr key={day.day} className="border-t border-gray-700 tabular-nums">
                          <td className="pr-4 py-1">{day.day}</td><td className="text-right pr-4">{fmt(day.visitors)}</td>
                          {EVENTS.map(name => <td key={name} className="text-right pr-4">{fmt(day.events[name])}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </Panel>

            <Panel title="Latest events" note="(newest first; refreshes every 5 minutes)">
              <div className="max-h-72 overflow-y-auto"><Latest events={data.recent || []} titles={data.titles || {}} /></div>
            </Panel>

            {data.saves?.totals && (
              <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(19rem,1fr))]">
                <Panel title="Hearted films" note={`(all time; ${fmt(data.saves.totals.hearts)} hearts from ${fmt(data.saves.totals.hearters)} people)`}><Board rows={data.saves.hearted} films titles={data.titles || {}} /></Panel>
                <Panel title="Films in people's channels" note={`(all time; ${fmt(data.saves.totals.channels)} channels, ${fmt(data.saves.totals.profiles)} profiles)`}><Board rows={data.saves.channels} films titles={data.titles || {}} /></Panel>
              </div>
            )}

            {data.community && (
              <Panel title="Community" note="(changes to profiles and channels, last 14 days, Pacific time; tags are the first 6 characters)">
                <Community community={data.community} />
              </Panel>
            )}

            <Panel title="Films this month" note={`(the most played and most opened${data.month <= NEW_SINCE.slice(0, 7) ? `; columns from "Where people stop" on count from ${NEW_SINCE}, so read them from next month` : ''})`}>
              <FilmsTable films={data.films} titles={data.titles || {}} />
            </Panel>

            {data.shares && (
              <Panel title="What gets watched" note="(share of this month's minutes beside share of the films on the site)">
                <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(19rem,1fr))]">
                  <Shares rows={data.shares.genres} label="Main genre" />
                  <Shares rows={data.shares.decades} label="Decade" />
                </div>
              </Panel>
            )}

            <Panel title="When people watch" note="(minutes this month, by Pacific hour)">
              <HourGrid rows={weekRows(data.hours)} />
              {channelRows(data.channelHours).length > 0 && (
                <>
                  <h3 className="text-sm text-gray-400 mt-4 mb-1">By channel</h3>
                  <HourGrid rows={channelRows(data.channelHours)} />
                </>
              )}
            </Panel>

            <Panel title="Profiles" note="(everyone, newest change first; open one for what they hearted, their channels and their changes)">
              <Profiles />
            </Panel>

            <Panel title="The log" note="(every event, newest first, up to 20,000; pick Search for every search as typed)">
              <Log />
            </Panel>

            <Panel title="Every search" note="(counts per month)">
              <AllSearches month={data.month} />
            </Panel>

            <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(19rem,1fr))]">
              {BOARDS.map(([key, title]) => (
                <Panel key={key} title={title}><Board rows={data.boards[key] || []} films={FILM_BOARDS.includes(key)} titles={data.titles || {}} /></Panel>
              ))}
            </div>
            <p className="text-gray-400 text-sm">Counts and a dated log of what happened: no cookies, no IP addresses, nothing that says who. Each browser tab carries a random visit id that is only counted into the funnel, never stored. Bots are not counted. Leaderboards are for the current month.</p>
          </main>
        )}
      </div>
    </div>
  );
}
