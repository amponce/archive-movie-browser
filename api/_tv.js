// The television service behind /api/tv. Channels are the curated lists; each film's length
// and stream URL come from its Archive.org record (cached here, refreshed hourly). One schedule
// feeds three outputs: JSON for the site, an M3U playlist and an XMLTV guide for other players.
import { readFileSync, readdirSync } from 'node:fs';
import { collectLists } from '../src/services/lists.js';
import { pickPlayableFile, videoUrl } from '../src/services/playback.js';
import { onAirAt, programmesBetween, airable } from '../src/services/schedule.js';

const SITE = 'https://www.orphanedfilms.com';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w342';
const RECORD_TTL = 60 * 60_000;

const listsDir = new URL('../src/lists/', import.meta.url);
const LISTS = collectLists(readdirSync(listsDir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(new URL(f, listsDir), 'utf8'))));
const index = JSON.parse(readFileSync(new URL('../public/poster-index.json', import.meta.url), 'utf8')).films;

// Every list is a channel, numbered in file order so a channel keeps its number
export const CHANNELS = LISTS.map((list, i) => ({ number: i + 1, id: list.slug, name: list.title, blurb: list.blurb, films: list.films.map(f => f.id) }));

// identifier -> { seconds, url, title, year, poster } from Archive.org's record, an hour at a time
const records = new Map();
async function record(id) {
  const hit = records.get(id);
  if (hit && Date.now() - hit.at < RECORD_TTL) return hit.value;
  let value = null;
  try {
    const data = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`).then(r => (r.ok ? r.json() : null));
    const file = data?.files ? pickPlayableFile(data.files) : null;
    const entry = index[id];
    if (file) {
      value = {
        id,
        title: entry?.t || data.metadata?.title || id,
        year: entry?.y || Number(String(data.metadata?.year || data.metadata?.date || '').slice(0, 4)) || null,
        poster: entry?.p ? `${TMDB_IMAGE}${entry.p}` : null,
        seconds: Number(file.length) || 0,
        url: videoUrl(id, file.name),
      };
    }
  } catch { /* Archive.org is down or the item is gone: the film just does not air */ }
  records.set(id, { at: Date.now(), value });
  return value;
}

async function lineupOf(channel) {
  const films = await Promise.all(channel.films.map(record));
  return airable(films.filter(Boolean));
}

// The whole service in one call: every channel with its lineup, what is on now, and the
// programmes for the next `hours`
export async function schedule({ now = Date.now(), hours = 6 } = {}) {
  const to = now + hours * 3600_000;
  const channels = await Promise.all(CHANNELS.map(async channel => {
    const lineup = await lineupOf(channel);
    const slot = onAirAt(lineup, now);
    return {
      number: channel.number,
      id: channel.id,
      name: channel.name,
      blurb: channel.blurb,
      lineup,
      now: slot && { film: slot.film, offset: slot.offset, startsAt: slot.startedAt, endsAt: slot.endsAt },
      programmes: programmesBetween(lineup, now, to).map(p => ({ id: p.film.id, title: p.film.title, year: p.film.year, poster: p.film.poster, startsAt: p.startsAt, endsAt: p.endsAt })),
    };
  }));
  return { now, epochNote: 'Every channel plays its lineup in order from a fixed moment, so this guide is the same for everyone.', channels: channels.filter(c => c.lineup.length) };
}

// An extended M3U: each channel's lineup in order, with lengths, as direct Archive.org streams
export function toM3U({ channels }) {
  const lines = ['#EXTM3U', `#PLAYLIST:Orphaned Films`, `#EXTENC:UTF-8`, `# Guide: ${SITE}/api/tv/guide.xml`];
  for (const channel of channels) {
    for (const film of channel.lineup) {
      lines.push(`#EXTINF:${Math.round(film.seconds)} tvg-id="${channel.id}" tvg-chno="${channel.number}" tvg-name="${escapeAttr(channel.name)}" tvg-logo="${film.poster || ''}" group-title="${escapeAttr(channel.name)}",${film.title}${film.year ? ` (${film.year})` : ''}`);
      lines.push(film.url);
    }
  }
  return `${lines.join('\n')}\n`;
}

// XMLTV for the next window, one <channel> per list and one <programme> per airing
export function toXMLTV({ channels }) {
  const stamp = ms => new Date(ms).toISOString().replace(/[-:]|\.\d{3}/g, '').replace('T', '').replace('Z', ' +0000');
  const out = ['<?xml version="1.0" encoding="UTF-8"?>', `<tv generator-info-name="Orphaned Films" source-info-url="${SITE}">`];
  for (const c of channels) out.push(`  <channel id="${c.id}"><display-name>${esc(c.name)}</display-name><display-name>${c.number}</display-name><url>${SITE}/tv#${c.id}</url></channel>`);
  for (const c of channels) {
    for (const p of c.programmes) {
      out.push(`  <programme start="${stamp(p.startsAt)}" stop="${stamp(p.endsAt)}" channel="${c.id}"><title>${esc(p.title)}</title>${p.year ? `<date>${p.year}</date>` : ''}${p.poster ? `<icon src="${p.poster}"/>` : ''}<url>${SITE}/browse#${encodeURIComponent(p.id)}</url></programme>`);
    }
  }
  out.push('</tv>');
  return `${out.join('\n')}\n`;
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = s => String(s).replace(/"/g, "'");
