# Security

## Reporting a vulnerability

Please **don't open a public issue** for a security problem. Use GitHub's private reporting instead: **Security > Report a vulnerability** on this repository ([direct link](https://github.com/amponce/archive-movie-browser/security/advisories/new)). You'll get a reply within a few days.

Useful things to include: what you found, how to reproduce it, and what an attacker could do with it.

## What's in scope

- The web app at https://archive-movie-browser.vercel.app and the code in this repository, including the MCP server in `mcp/` and the GitHub Actions workflows.
- Examples: script injection through Archive.org metadata, a way around the Content-Security-Policy in `vercel.json`, anything that could expose the repository's Actions secrets.

## What isn't

- The TMDB key in the site's JavaScript bundle. Any `VITE_` variable is public by design; it is a free, read-only key. (Keys that must stay private, like the one used to build the poster index, live only in GitHub's encrypted secrets and never reach the browser.)
- Content hosted on Archive.org itself: report that to the [Internet Archive](https://archive.org/about/contact).
- Vulnerabilities in dependencies with no impact here. Dependabot already watches them.
