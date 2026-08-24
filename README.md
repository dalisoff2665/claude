# context-dev-agent-tools

Server-side [Context.dev](https://www.context.dev) web-data tools, exposed as
**LLM function-calling tools** an agent can call: web search, scrape-to-Markdown,
structured extraction, and site crawl — all routed through one wrapper module.

> One API for web data. One key covers everything. Base URL `https://api.context.dev/v1`,
> auth `Authorization: Bearer $CONTEXT_DEV_API_KEY`.

## Setup

```sh
npm install
cp .env.example .env       # then paste your key into .env
```

`.env` (git-ignored):

```env
CONTEXT_DEV_API_KEY=ctxt_secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Get / rotate keys at https://www.context.dev/dashboard/api-keys.

## Give an LLM the tools

```ts
import { CONTEXT_TOOLS, runTool } from './src/agent/index.js';

// 1. Advertise the tools to the model (Anthropic tool-use shape).
//    Use toOpenAITools() instead for OpenAI function-calling.
const tools = CONTEXT_TOOLS;

// 2. When the model emits a tool call, dispatch it:
const result = await runTool('web_search', { query: 'best TS web scraping API', numResults: 10 });
// -> { ok: true, tool: 'web_search', data: { query, results: [...] }, credits: { consumed, remaining } }

// 3. Feed result.data back to the model as the tool result.
```

Tools: `web_search`, `web_scrape_markdown`, `web_extract`, `web_crawl`. Bad input is
rejected locally (no API call, no credits); every failure comes back as a structured
`error` (`{ code, message, status, retriable }`) the model can read.

## Or call the wrapper directly

```ts
import { getContextWrapper } from './src/context/index.js';

const ctx = getContextWrapper();
const search = await ctx.search('context.dev pricing', { numResults: 10 });
const page = await ctx.scrapeMarkdown('https://example.com', { maxAgeMs: 0 }); // 0 = fresh
const data = await ctx.extract('https://acme.example', {
  type: 'object',
  properties: { company: { type: 'string' }, pricingTiers: { type: 'array', items: { type: 'string' } } },
});
const site = await ctx.crawl('https://docs.example.com', { maxPages: 25 });
```

Every Context.dev call goes through `src/context/wrapper.ts` — see `CLAUDE.md`.

## Scripts

```sh
npm test          # offline, mock-backed suite (no network, no credits)
npm run typecheck # tsc --noEmit
npm run proof     # ONE real web_search call — prints results + credit usage
npm run build     # tsc -> dist/
```

`npm run proof` needs `CONTEXT_DEV_API_KEY` and outbound access to `api.context.dev`.
On a restricted network it reports `403 Host not in allowlist` — that's the egress policy,
not a code error; run where the host is reachable.

## How it fits together

```
LLM tool call ─▶ runTool(name, input)        src/agent/executor.ts   (validate + shape)
                     │
                     ▼
              ContextWrapper                 src/context/wrapper.ts  (the one choke point)
                     │  auth · retries · maxAgeMs · credits · error normalization
                     ▼
              context.dev SDK ─▶ https://api.context.dev/v1
```

Docs (source of truth): https://docs.context.dev — append `.md` to any page for markdown.
