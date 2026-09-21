import React, { useEffect, useState } from 'react';

const KEY = 'stats-key';
const MARK = '#c08a10'; // single series; passes the dark-surface lightness and contrast checks
const EVENTS = ['Page view', 'Film opened', 'Play', 'Watched 10 minutes', 'Search', 'Filter', 'Load more'];
const FILM_BOARDS = ['played', 'watched', 'opened'];
const BOARDS = [
  ['played', 'Films played'], ['watched', 'Watched 10+ minutes'], ['opened', 'Films opened'], ['searches', 'Searches'], ['filters', 'Filters used'],
  ['referrers', 'Where visitors came from'], ['pages', 'Pages'], ['players', 'Player used'], ['banner', 'MCP banner'],
];

const fmt = (n) => Number(n || 0).toLocaleString();
const sum = (days, name) => days.reduce((total, day) => total + (day.events[name] || 0), 0);
const readKey = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };

async function fetchStats(key) {
  const response = await fetch('/api/stats', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 404 ? 'That key was not accepted.' : `The stats could not be loaded (${response.status}).`);
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

// A film by its name, linking to it; the Archive.org identifier is the fallback and the tooltip
const Film = ({ id, titles }) => <a href={`/#${encodeURIComponent(id)}`} title={id} className="hover:text-yellow-400 hover:underline">{titles[id] || id}</a>;

function Board({ rows, films, titles }) {
  if (!rows.length) return <p className="text-gray-400">Nothing yet this month.</p>;
  const top = rows[0][1] || 1;
  return (
    <table className="w-full">
      <tbody>
        {rows.map(([label, count]) => (
          <tr key={label} className="border-b border-gray-700">
            <td className="py-1.5 pr-3 max-w-0 w-[60%] truncate" title={label}>{films ? <Film id={label} titles={titles} /> : label}</td>
            <td><div className="h-2 rounded-r min-w-[2px]" style={{ width: `${(count / top) * 100}%`, background: MARK }} /></td>
            <td className="w-14 text-right tabular-nums">{fmt(count)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// What just happened, newest first: the quickest way to see that something was counted
function Latest({ events, titles }) {
  if (!events.length) return <p className="text-gray-400">Nothing yet.</p>;
  const detail = ({ name, data }) => data.film ? <Film id={data.film} titles={titles} />
    : name === 'Search' ? (data.query ? `“${data.query}”` : 'a pasted link')
    : name === 'Filter' ? `${data.type}: ${data.value}`
    : name === 'Page view' ? `${data.path}${data.referrer ? ` from ${data.referrer}` : ''}`
    : data.action || data.player || '';
  return (
    <table className="w-full text-sm">
      <tbody>
        {events.map((event, i) => (
          <tr key={i} className="border-b border-gray-700">
            <td className="py-1 pr-3 text-gray-400 tabular-nums whitespace-nowrap">{new Date(event.at).toLocaleTimeString()}</td>
            <td className="py-1 pr-3 whitespace-nowrap">{event.name}{event.data.player ? ` (${event.data.player} player)` : ''}</td>
            <td className="py-1 max-w-0 w-[55%] truncate">{detail(event)}</td>
          </tr>
        ))}
      </tbody>
    </table>
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
    document.title = 'Stats | Archive Movie Browser';
    if (readKey()) load(readKey());
    // Keep the numbers current while the page is open and in view
    const timer = setInterval(() => { if (readKey() && !document.hidden) load(readKey()); }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const forget = () => { try { localStorage.removeItem(KEY); } catch { /* private mode */ } setData(null); setEntered(''); };
  const week = data?.days.slice(-7) || [];
  const tiles = data && [
    [data.days.at(-1).visitors, 'visitors today'], [data.visitorsThisMonth, 'visitors this month'], [sum(week, 'Page view'), 'page views, 7 days'],
    [sum(week, 'Film opened'), 'films opened, 7 days'], [sum(week, 'Play'), 'plays, 7 days'], [sum(week, 'Watched 10 minutes'), 'watched 10+ min, 7 days'], [sum(week, 'Search'), 'searches, 7 days'],
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200">
      <div className="max-w-6xl mx-auto p-5">
        <header className="flex flex-wrap justify-between items-baseline gap-4 mb-6">
          <h1 className="text-2xl font-semibold">Archive Movie Browser: usage</h1>
          <span className="flex items-center gap-3 text-sm">
            <a href="/" className="text-yellow-400 underline">Back to the films</a>
            {data && <span className="text-gray-400">Updated {updated?.toLocaleTimeString()}</span>}
            {data && <button onClick={() => load(readKey())} className="border border-gray-700 rounded-md px-3 py-1 text-gray-300 hover:text-white">Refresh</button>}
            {data && <button onClick={forget} className="border border-gray-700 rounded-md px-3 py-1 text-gray-400 hover:text-white">Forget key on this device</button>}
          </span>
        </header>

        {!data && (
          <section>
            <p>This page is for the maintainer. Paste the stats key to see the numbers.</p>
            <form className="flex gap-2 max-w-md mt-4" onSubmit={(event) => { event.preventDefault(); load(entered.trim()); }}>
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

            <Panel title="Visitors per day" note="(estimated distinct people, last 30 days, UTC)">
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

            <Panel title="Latest events" note="(newest first; refreshes every 30 seconds)">
              <div className="max-h-72 overflow-y-auto"><Latest events={data.recent || []} titles={data.titles || {}} /></div>
            </Panel>

            <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(19rem,1fr))]">
              {BOARDS.map(([key, title]) => (
                <Panel key={key} title={title}><Board rows={data.boards[key] || []} films={FILM_BOARDS.includes(key)} titles={data.titles || {}} /></Panel>
              ))}
            </div>
            <p className="text-gray-400 text-sm">Counts only: no cookies, no IP addresses, no visitor identifiers. Bots are not counted. Leaderboards are for the current month.</p>
          </main>
        )}
      </div>
    </div>
  );
}
