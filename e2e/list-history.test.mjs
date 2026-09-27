// Run against `npm run dev`: node --test e2e/list-history.test.mjs
// Requires Playwright installed separately; PLAYWRIGHT_MODULE may name its module URL.
import test from 'node:test';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://localhost:3000';
const ids = ['ROBOCOPCC', 'the.-spanish.-prisoner.-1997.-dvd.-rip'];
const titles = ['RoboCop', 'The Spanish Prisoner'];

async function withPage(run) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'archive.org' && url.pathname.startsWith('/metadata/')) {
        const identifier = decodeURIComponent(url.pathname.slice('/metadata/'.length));
        return route.fulfill({ json: { metadata: { identifier, title: titles[ids.indexOf(identifier)] || identifier, year: '1987', mediatype: 'movies', runtime: '100', description: 'History regression fixture' }, files: [] } });
      }
      if (url.origin === new URL(base).origin) {
        if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { results: [] } });
        return route.continue();
      }
      return route.fulfill({ json: { response: { docs: [], numFound: 0 } } });
    });
    await run(page);
  } finally {
    await browser.close();
  }
}

async function expectFilm(page, id) {
  await page.getByRole('dialog').waitFor({ state: 'visible', timeout: 10000 });
  await page.getByRole('dialog').getByRole('heading', { name: titles[ids.indexOf(id)], exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, `#${id}`);
}

test('list film survives reload and Forward, and the next film gets its own hash', async () => {
  await withPage(async page => {
    await page.goto(`${base}/lists/after-hours`);
    await page.locator('ol button').first().click();
    await expectFilm(page, ids[0]);
    await page.reload();
    await expectFilm(page, ids[0]);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(new URL(page.url()).hash, '');
    await page.goForward();
    await expectFilm(page, ids[0]);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.locator('ol button').nth(1).click();
    await expectFilm(page, ids[1]);
  });
});

test('a shared list-film URL opens directly and closes to the same list', async () => {
  await withPage(async page => {
    await page.goto(`${base}/lists/after-hours#${ids[1]}`);
    await expectFilm(page, ids[1]);
    await page.getByRole('dialog').getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(new URL(page.url()).pathname, '/lists/after-hours');
    assert.equal(new URL(page.url()).hash, '');
  });
});