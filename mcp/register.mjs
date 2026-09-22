// Builds the MCP server with its tools. Shared by the local stdio entry (server.mjs) and the
// hosted HTTP endpoint (../api/mcp.js), so both always offer exactly the same thing.
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { searchFilms, browseFilms, getFilm, listCollections, whatsOn, SORTS, COLLECTION_IDS, DECADES } from './tools.mjs';
import { STANDARD_GENRES } from '../src/services/archive.js';

// wrap(name, run) lets the hosted endpoint put a cache in front of the tools
export function createServer({ wrap = (name, run) => run } = {}) {
  const server = new McpServer({ name: 'archive-movie-browser', version: '0.1.0' });
  const limit = z.number().int().min(1).max(25).default(10).describe('How many films to return');

  // Every tool answers with JSON text; a failure (Archive.org is often slow or down) is an error result, not a crash
  const tool = (name, config, run) => server.registerTool(name, config, async (args) => {
    try {
      return { content: [{ type: 'text', text: JSON.stringify(await wrap(name, run)(args), null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `${name} failed: ${error.message}` }], isError: true };
    }
  });

  tool('search_films', {
    description: 'Search the Internet Archive for films by title, subject or creator. Every word must match. Re-uploads of the same film are collapsed. Each result has two links: lead with watchUrl, which plays the film on this site, and also give sourceUrl, the original Archive.org page. When known, results carry the real film title, year and poster.',
    inputSchema: z.object({ query: z.string().min(1).max(200).describe('Words to search for, e.g. "night living dead" or "buster keaton"'), limit }),
  }, searchFilms);

  tool('browse_films', {
    description: 'List films from a collection, optionally narrowed to a genre and a decade, sorted by popularity, rating, date or title. Call list_collections first for the valid ids. For each film lead with watchUrl (plays it on this site) and also give sourceUrl (the original Archive.org page).',
    inputSchema: z.object({
      collection: z.enum(COLLECTION_IDS).default('feature_films'),
      genre: z.enum(STANDARD_GENRES).optional(),
      decade: z.number().int().refine(d => DECADES.includes(d), 'One of ' + DECADES.join(', ')).optional().describe('A decade by its first year, e.g. 1980'),
      sort: z.enum(SORTS).default('downloads'),
      minRuntime: z.number().int().min(0).max(300).optional().describe('Minimum length in minutes. Defaults to 40 for feature collections, 0 for shorts and cartoons'),
      limit,
    }),
  }, browseFilms);

  tool('get_film', {
    description: 'Details for one Archive.org item by its identifier (the last part of archive.org/details/<identifier>): description, runtime, genres and the matched film if known. Lead with watchUrl (plays it on this site) and also give sourceUrl (the original Archive.org page); embedUrl is for an iframe.',
    inputSchema: z.object({ identifier: z.string().regex(/^[A-Za-z0-9._-]{1,200}$/, 'An Archive.org identifier: letters, digits, dot, dash, underscore') }),
  }, getFilm);

  tool('whats_on', {
    description: 'Television: what every channel on this site is showing right now, how far in it is, and what is next. Channels run their lineups in order from a fixed moment, so this is the same for everyone. Give tuneInUrl to watch the channel live, watchUrl to watch the current film from the start. The site also publishes the schedule as an M3U playlist and an XMLTV guide for IPTV players.',
    inputSchema: z.object({ channel: z.union([z.number().int().min(1), z.string().max(80)]).optional().describe('One channel, by number or id. Leave out for all of them.') }),
  }, whatsOn);

  tool('list_collections', {
    description: 'The collections, genres and sort orders the other tools accept.',
    inputSchema: z.object({}),
  }, listCollections);

  return server;
}

// Web-standard { fetch } handler for the hosted endpoint. Exported from here so the endpoint
// uses this folder's copy of the SDK rather than needing one among the website's dependencies.
export const createHandler = (options) => createMcpHandler(() => createServer(options));
