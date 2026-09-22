import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// In development, serve the Vercel functions in api/ from the same server, so /api/tv and the
// rest work on localhost without the Vercel CLI. Each request re-imports the module, so edits
// to api/ files show up on the next request.
function localApi() {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        const name = url.pathname.match(/^\/api\/([a-z_-]+)\/?$/)?.[1];
        const file = name && `${process.cwd()}/api/${name}.js`;
        if (!file || !existsSync(file)) return next();
        const { default: handler } = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
        req.query = Object.fromEntries(url.searchParams);
        res.status = code => { res.statusCode = code; return res; };
        res.json = body => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
        res.send = body => res.end(body);
        try { await handler(req, res); } catch (error) { res.status(500).json({ error: error.message }); }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localApi()],
  server: {
    port: 3000,
    open: true
  }
});
