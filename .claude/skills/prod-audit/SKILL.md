---
name: prod-audit
description: How the production-readiness audit of archive-movie-browser is run, what it covers, and the decisions it must respect. Read by every prod-audit-* agent before acting.
---

# Production-readiness audit: shared knowledge

## What this project is
A React 19 + Vite static app on Vercel (https://www.orphanedfilms.com, also archive-movie-browser.vercel.app) that browses and plays films hosted by the Internet Archive, plus two Vercel functions (`api/mcp.js`, an MCP server; `api/event.js` + `api/stats.js`, our own cookieless analytics on Upstash Redis) and a local MCP server in `mcp/`. Pure logic lives in `src/services/` (tested with `node:test`); UI in `src/components/` and `src/pages/`; hooks in `src/hooks/`.

## Commands
- App tests: `npm test` (src/**/*.test.js). Server-side tests: `npm test --prefix mcp`. Build: `npm run build`. Vercel build check: `vercel build --prod` (repo is linked).
- Local build with the production security headers (CSP!): `node <scratch>/serve-with-headers.mjs "$PWD"` serves `dist/` on :4180 with the headers from `vercel.json`. If the scratch copy is gone, recreate it: read `vercel.json` headers, serve `dist/`, fall back to `index.html`.
- Browser checks: Playwright (chromium + webkit installed under the scratchpad `wk/` folder; `npx playwright install chromium webkit` if missing). Existing scripts worth reusing/adapting: `agree.mjs` (filters), `toprated.mjs` (card stability + Load more), `url.mjs` (URL state, Back/Forward), `player.mjs` (own player, shortcuts, resume, fallback), `paste.mjs` (pasted Archive links), `tags.mjs` (type-ahead), `detailsearch.mjs` (search from the film page), `clearrecent.mjs`, `landing.mjs`, `pillsonly.mjs`, `jump.mjs` (scroll jumps across engines), `analytics.mjs`, `mcppage.mjs`, `filters.mjs` (phone layout).
- MCP: `cd mcp && node --input-type=module -e "import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'; ..."` against `https://www.orphanedfilms.com/api/mcp`.
- Stats (maintainer only): `T=$(grep '^STATS_TOKEN=' .env.local | cut -d= -f2-); curl -s -H "Authorization: Bearer $T" https://www.orphanedfilms.com/api/stats`. Never print T.

## Surfaces to inventory (start here; inventory refines)
Home/browse (landing = All Films + Horror pill), filters (dropdown, pills, decade, runtime, sort, Shorts), search box (type-ahead, tags, recent + clear, pasted Archive links), film page (dialog, focus, history, related, search bar), own player (shortcuts, resume, fallback iframe), Load more / end of list, URL state (share, reload, Back/Forward, old links), phone layout (390px), keyboard + screen reader (dialog, combobox, pills), generated covers, poster index + TMDB fallback, MCP banner, `/mcp` page, `/stats` page (gate), `/api/mcp` (tools, CORS, rate limit, cache), `/api/event` (validation, origin check, bot filter, rate limit), `/api/stats` (auth), security headers/CSP, error states (Archive.org 502/timeout, offline), performance (bundle size, first load, TMDB request count), README/CONTRIBUTING accuracy, CI.

## Decisions already made (do not re-litigate; mark related findings `wontfix` with the reason)
- The app mirrors Archive.org: no copyright filtering beyond the existing `isBlockedContent` blocklist. Removal requests go to the Internet Archive (footer says so).
- No Next.js rebuild; no router library (3 pages, path switch in `App.jsx`); no backend beyond the Vercel functions; forks must deploy as static files elsewhere.
- Analytics is our own (Redis counts, no cookies, no IPs). Vercel Web Analytics is not to be enabled. `STATS_TOKEN` gates `/stats`.
- Landing view is All Films + Horror (best posters). Genre lives in the pills only; the dropdown lists libraries. `?genre=all` means All Genres.
- Release-date sorts exclude dates equal to the upload year or the year before (they are upload dates). Unknown-length uploads under 100 MB are not "full movies".
- Load more, not pagination or infinite scroll.
- Product wording avoids "AI": say "MCP server", "Claude, Cursor and other MCP clients".
- MCP results carry `watchUrl` (ours) first and `sourceUrl` (Archive.org) second.
- Never merge with red CI; `--admin` only bypasses the self-approval rule.

## Severity scale (for findings)
- **S1** data loss, security (XSS, secret exposure, auth bypass), production 5xx, site unusable on a mainstream browser/phone.
- **S2** a core flow broken for some users (play, search, filters, Back button, keyboard access, CSP blocking a feature).
- **S3** wrong but survivable (misleading label, stale doc, slow path, layout glitch).
- **S4** polish.

## Evidence standard
A finding without a reproduction (command/script + observed vs expected) is a hypothesis, not a finding: label it `needs-repro` and do not cluster it for fixing.
