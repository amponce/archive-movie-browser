# List history browser regression

Start the app with `npm run dev`, then run:

```sh
node --test e2e/list-history.test.mjs
```

This optional browser check requires Playwright and its Chromium browser.
Use an existing Playwright installation by setting `PLAYWRIGHT_MODULE` to the
module's file URL, or install it locally without changing the project manifest
or lockfile (`npm install --no-save --package-lock=false playwright`, then
`npx playwright install chromium`). Set `BASE_URL` if the app uses a different
address from `http://localhost:3000`.

The tests run the real list page and dialog with deterministic Archive.org
metadata fixtures. They cover open/reload/Escape/Forward, opening a different
film afterward, and arriving directly through a shared list-film URL. They do
not verify Archive.org availability or video playback. No API key is needed.
