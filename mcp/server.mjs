#!/usr/bin/env node
// MCP server for the Internet Archive's films, over stdio.
//   node mcp/server.mjs            (see mcp/README.md for Claude Desktop, Claude Code and Cursor)
import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { searchFilms, browseFilms, getFilm, listCollections, SORTS, COLLECTION_IDS, DECADES } from './tools.mjs';
import { STANDARD_GENRES } from '../src/services/archive.js';

const server = new McpServer({ name: 'archive-movie-browser', version: '0.1.0' });
const limit = z.number().int().min(1).max(25).default(10).describe('How many films to return');

// Every tool answers with JSON text; a failure (Archive.org is often slow or down) is an error result, not a crash
const tool = (name, config, run) => server.registerTool(name, config, async (args) => {
  try {
    return { content: [{ type: 'text', text: JSON.stringify(await run(args), null, 2) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `${name} failed: ${error.message}` }], isError: true };
  }
});

tool('search_films', {
  description: 'Search the Internet Archive for films by title, subject or creator. Every word must match. Re-uploads of the same film are collapsed. Each result has a watchUrl, an embedUrl and, when known, the real film title, year and poster.',
  inputSchema: z.object({ query: z.string().min(1).max(200).describe('Words to search for, e.g. "night living dead" or "buster keaton"'), limit }),
}, searchFilms);

tool('browse_films', {
  description: 'List films from a collection, optionally narrowed to a genre, sorted by popularity, rating, date or title. Call list_collections first for the valid ids.',
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
  description: 'Details for one Archive.org item by its identifier (the last part of archive.org/details/<identifier>): description, runtime, genres, links and the matched film if known.',
  inputSchema: z.object({ identifier: z.string().regex(/^[A-Za-z0-9._-]{1,200}$/, 'An Archive.org identifier: letters, digits, dot, dash, underscore') }),
}, getFilm);

tool('list_collections', {
  description: 'The collections, genres and sort orders the other tools accept.',
  inputSchema: z.object({}),
}, listCollections);

await server.connect(new StdioServerTransport());
