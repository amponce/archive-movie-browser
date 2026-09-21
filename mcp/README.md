# archive-movie-mcp

An [MCP](https://modelcontextprotocol.io) server that lets an AI assistant find, browse and recommend public-domain films on the Internet Archive. Ask Claude "recommend a noir under 70 minutes from the 1940s" and get a shortlist of real films that play.

It reuses the web app's Archive.org logic (`../src/services`), so it searches every collection at once, collapses re-uploads of the same film, and knows which messy upload (`H 2 House On Haunted Hill ( 1959) Classic...`) is which real film, thanks to the [poster index](../README.md#poster-index). No API keys needed.

## Tools

| Tool | What it does |
|---|---|
| `search_films` | Search by title, subject or creator across all collections |
| `browse_films` | List a collection, optionally by genre, sorted by popularity, rating, date or title |
| `recommend_films` | Curated shortlist by genre, runtime and decade, filtered from known titles |
| `get_film` | Details, links and the matched film for one Archive.org identifier |
| `list_collections` | The collections, genres and sort orders the other tools accept |

Every film comes back with `watchUrl` (plays on the site), `archiveUrl`, `embedUrl` (drop into an iframe) and, when the index knows the film, its real `title`, `year`, `posterUrl` and `tmdbId`.

## Run it

Needs Node 22+.