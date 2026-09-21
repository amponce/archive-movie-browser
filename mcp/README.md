# archive-movie-mcp

An [MCP](https://modelcontextprotocol.io) server that lets an AI assistant find and watch public-domain films on the Internet Archive. Ask Claude "find me a noir under 70 minutes" and get real films with links that play.

It reuses the web app's Archive.org logic (`../src/services`), so it searches every collection at once, collapses re-uploads of the same film, and knows which messy upload (`H 2 House On Haunted Hill ( 1959) Classic...`) is which real film, thanks to the [poster index](../README.md#poster-index). No API keys needed.

## Tools

| Tool | What it does |
|---|---|
| `search_films` | Search by title, subject or creator across all collections |
| `browse_films` | List a collection, optionally by genre, sorted by popularity, rating, date or title |
| `get_film` | Details, links and the matched film for one Archive.org identifier |
| `list_collections` | The collections, genres and sort orders the other tools accept |

Every film comes back with `watchUrl` (plays on the site), `archiveUrl`, `embedUrl` (drop into an iframe) and, when the index knows the film, its real `title`, `year`, `posterUrl` and `tmdbId`.

## Run it

Needs Node 22+.

```bash
git clone https://github.com/amponce/archive-movie-browser.git
cd archive-movie-browser/mcp && npm install
```

**Claude Code**

```bash
claude mcp add archive-movies -- node /absolute/path/to/archive-movie-browser/mcp/server.mjs
```

**Claude Desktop, Cursor and others**: add to the MCP config file:

```json
{
  "mcpServers": {
    "archive-movies": { "command": "node", "args": ["/absolute/path/to/archive-movie-browser/mcp/server.mjs"] }
  }
}
```

Poke at it by hand with the inspector: `npx @modelcontextprotocol/inspector node server.mjs`

## Develop

```bash
npm test          # starts the real server over stdio; no network needed
LIVE=1 npm test   # also runs one search against Archive.org
```

`tools.mjs` holds the tools as plain functions; `server.mjs` only registers them. Archive.org is slow (2-4 s) and throttles busy clients, so keep tools to a few requests per call.

Ideas and open work are tracked in the issues labelled [`mcp`](https://github.com/amponce/archive-movie-browser/issues?q=is%3Aissue+is%3Aopen+label%3Amcp).
