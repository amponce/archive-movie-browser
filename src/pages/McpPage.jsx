import React, { useEffect } from 'react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';

const REPO = 'https://github.com/amponce/archive-movie-browser';
const ENDPOINT = 'https://archive-movie-browser.vercel.app/api/mcp';

const QUESTIONS = [
  '“Find me a film noir from the 1940s that runs under ninety minutes.”',
  '“What Buster Keaton films can I watch tonight, free and legal?”',
  '“Which film is this Archive upload, really: dead_people_ipod?”',
];

const TOOLS = [
  ['search_films', 'Search by title, subject or creator across every collection at once. Re-uploads of the same film are collapsed into one.'],
  ['browse_films', 'List a collection by genre and decade, sorted by popularity, rating, release date or title.'],
  ['get_film', 'Everything about one upload: description, length, genres, and the real film it is, if known.'],
  ['list_collections', 'The collections, genres, decades and sort orders the other tools accept.'],
];

const Code = ({ children }) => (
  <pre tabIndex={0} className="bg-black border border-line rounded-lg p-4 overflow-x-auto my-3 text-sm"><code>{children}</code></pre>
);
const Heading = ({ children }) => <h2 className="display text-3xl tracking-wide mt-14 mb-4">{children}</h2>;
const Aside = ({ children }) => <p className="text-muted text-[0.95rem] max-w-2xl">{children}</p>;
const link = 'text-signal underline underline-offset-4 hover:no-underline';

export default function McpPage() {
  useEffect(() => { document.title = 'MCP server: ask your assistant what to watch | Archive Movie Browser'; }, []);

  return (
    <div className="min-h-screen text-muted leading-relaxed">
      <SiteHeader current="/mcp" />
      <div className="max-w-5xl mx-auto px-5">
        <main>
          <h1 className="display text-[clamp(2.75rem,9vw,5.5rem)] leading-[0.95] mt-10 mb-5 max-w-[12ch] text-bone">
            Ask your assistant what to watch.
          </h1>
          <p className="text-xl text-muted max-w-2xl mb-10">
            The film catalogue behind this site now speaks <a className={link} href="https://modelcontextprotocol.io">MCP</a>. Connect it to Claude,
            Cursor or any MCP client, and it can search tens of thousands of public-domain films on the Internet Archive and hand back links that play.
          </p>

          {/* Silent-film intertitles: what you might ask */}
          <ul aria-label="Things you can ask" className="grid md:grid-cols-3 gap-4 mb-4">
            {QUESTIONS.map(question => (
              <li
                key={question}
                className="bg-[#050505] text-[#efe6d0] border border-[#6b6350] outline outline-1 outline-[#6b6350] -outline-offset-[7px] px-6 py-9 min-h-[8rem] md:min-h-[11rem] flex items-center justify-center text-center italic text-lg leading-snug"
                style={{ fontFamily: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif" }}
              >
                {question}
              </li>
            ))}
          </ul>
          <Aside>
            That last one is <em>Messiah of Evil</em> (1975). Archive.org titles are messy; the server knows which real film hundreds of the
            most-watched uploads are, with year and poster.
          </Aside>

          <Heading>What it can do</Heading>
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left text-sm text-muted"><th scope="col" className="py-2 pr-3 font-semibold">Tool</th><th scope="col" className="py-2 font-semibold">What it does</th></tr>
            </thead>
            <tbody>
              {TOOLS.map(([name, what]) => (
                <tr key={name} className="border-t border-line align-top">
                  <td className="py-3 pr-3 md:whitespace-nowrap"><code className="bg-panel px-1.5 py-0.5 rounded text-sm">{name}</code></td>
                  <td className="py-3">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3">
            <Aside>Every film comes back with a link that plays on this site and a link to its original Archive.org page. No API keys, no account.</Aside>
          </div>

          <Heading>Try it now</Heading>
          <div className="max-w-2xl">
            <p>Nothing to install. The server is hosted here, free and read-only:</p>
            <Code>{ENDPOINT}</Code>
            <p>In Claude, open Settings, then Connectors, choose <em>Add custom connector</em> and paste that address. In Claude Code:</p>
            <Code>{`claude mcp add --transport http archive-movies ${ENDPOINT}`}</Code>
            <p>In Cursor and most other clients, add it to the MCP settings file:</p>
            <Code>{`{\n  "mcpServers": {\n    "archive-movies": { "url": "${ENDPOINT}" }\n  }\n}`}</Code>
            <Aside>It is a shared endpoint: 40 requests a minute per address, and answers are cached for 15 minutes. For heavier use, run your own copy.</Aside>
          </div>

          <Heading>Run your own copy</Heading>
          <div className="max-w-2xl">
            <p>You need <a className={link} href="https://nodejs.org">Node.js</a> 22 or newer. Get the code and install the server's two dependencies:</p>
            <Code>{`git clone ${REPO}.git\ncd archive-movie-browser/mcp && npm install`}</Code>
            <p>Then tell your assistant where it is. In Claude Code:</p>
            <Code>claude mcp add archive-movies -- node /absolute/path/to/archive-movie-browser/mcp/server.mjs</Code>
            <p>In Claude Desktop, Cursor and most other clients, add this to the MCP settings file:</p>
            <Code>{`{\n  "mcpServers": {\n    "archive-movies": {\n      "command": "node",\n      "args": ["/absolute/path/to/archive-movie-browser/mcp/server.mjs"]\n    }\n  }\n}`}</Code>
            <p>The <a className={link} href={`${REPO}/blob/main/mcp/README.md`}>README</a> has the details and how to run the tests.</p>
          </div>

          <Heading>Help build it</Heading>
          <p className="max-w-2xl">
            The server is new and small on purpose. A one-line <code className="bg-panel px-1.5 py-0.5 rounded text-sm">npx</code> install, a recommendation
            tool and a “movie night” prompt are all <a className={link} href={`${REPO}/issues?q=is%3Aissue+is%3Aopen+label%3Amcp`}>open issues</a>,
            written up and ready for someone to take. It is MIT licensed, like the rest of the project.
          </p>
        </main>
      </div>
      <SiteFooter><a href={`${REPO}/tree/main/mcp`} className="label hover:text-bone">Source</a></SiteFooter>
    </div>
  );
}
