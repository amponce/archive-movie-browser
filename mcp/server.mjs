#!/usr/bin/env node
// MCP server for the Internet Archive's films, over stdio.
//   node mcp/server.mjs            (see mcp/README.md for Claude Desktop, Claude Code and Cursor)
// The same tools are hosted over HTTP at https://archive-movie-browser.vercel.app/api/mcp
import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createServer } from './register.mjs';

await createServer().connect(new StdioServerTransport());
