# CLAUDE.md — project conventions

Server-side **Context.dev** web-data tools exposed as **LLM function-calling tools**.
TypeScript / Node (ESM, NodeNext). Read this before adding Context.dev calls.

## Golden rule: one wrapper, server-side only

**Every Context.dev call goes through `src/context/wrapper.ts` (`ContextWrapper`).**
Nothing else may import the SDK client or call `api.context.dev` directly. This keeps
auth, retries, error handling, credit accounting, and cache (`maxAgeMs`) policy in one
auditable place. Everything under `src/context/` is server-only — never import it into
browser/client code, and never expose the API key to a bundle.

## The secret

- Env var: **`CONTEXT_DEV_API_KEY`** — read from the environment (see `.env.example`).
  The SDK picks it up automatically; we also validate it in `src/context/config.ts`.
- `.env` holds the real key and is **git-ignored**. `.env.example` is the committed
  template. Rotate keys at https://www.context.dev/dashboard/api-keys.
- Optional env overrides: `CONTEXT_DEV_BASE_URL`, `CONTEXT_DEV_MAX_RETRIES`,
  `CONTEXT_DEV_TIMEOUT_MS`, `CONTEXT_DEV_DEFAULT_MAX_AGE_MS`.

## SDK

- Package: **`context.dev`** (official TypeScript SDK, `import ContextDev from 'context.dev'`).
- Base URL: `https://api.context.dev/v1` · Auth: `Authorization: Bearer $CONTEXT_DEV_API_KEY`.
- Prefer the SDK over hand-rolled HTTP. The SDK already implements the retry policy we
  want: it honors `Retry-After` on **429** and retries **408/409/5xx** with bounded
  exponential backoff (`maxRetries`, default 2); validation errors (**400/422**) are
  **never** retried. Do not add a second retry layer.

## Layout

```
src/context/   the ONLY place that touches the SDK
  config.ts    resolveConfig() — reads/validates env
  client.ts    createContextClient() / getContextClient() — builds the SDK client
  errors.ts    ContextApiError + normalizeError() — one stable error shape
  wrapper.ts   ContextWrapper — search / scrapeMarkdown / extract / crawl
src/agent/     LLM-facing layer
  tools.ts     tool schemas (Anthropic shape) + toOpenAITools() adapter
  executor.ts  createToolExecutor(wrapper) -> runTool(name, input) -> ToolResult
scripts/proof.ts   one real web_search call (npm run proof)
test/              offline, mock-backed suite (npm test)
```

## Endpoints wired (and their docs — source of truth)

Read the endpoint's docs page before changing how it's called. Docs support a plain
`.md` suffix (e.g. `curl -s https://docs.context.dev/api-reference/web-scraping/search.md`).

| Wrapper method            | HTTP                          | Credits | Docs |
| ------------------------- | ----------------------------- | ------- | ---- |
| `search`                  | `POST /web/search`            | 1 / 10 results | https://docs.context.dev/api-reference/web-scraping/search |
| `scrapeMarkdown`          | `GET /web/scrape/markdown`    | 1 (2 w/ actions) | https://docs.context.dev/api-reference/web-scraping/markdown |
| `extract`                 | `POST /web/extract`           | 10 | https://docs.context.dev/api-reference/web-extraction/extract |
| `crawl`                   | `POST /web/crawl`             | 1 / page | https://docs.context.dev/api-reference/web-scraping/crawl |

SDK method names differ from the wrapper's: `client.web.search`, `client.web.webScrapeMd`,
`client.web.extract`, `client.web.webCrawlMd`. Full API surface (brand intel, parse,
screenshot, sitemap, batch, monitors) lives on `client.web.*` and the other resources —
add a wrapper method when you need one; don't call the client elsewhere.

## Agent tools

Four tools: `web_search`, `web_scrape_markdown`, `web_extract`, `web_crawl`
(`CONTEXT_TOOLS` in `src/agent/tools.ts`). Pass them to an Anthropic model as-is, or
`toOpenAITools()` for OpenAI function-calling. Dispatch a model's tool call with
`runTool(name, input)`; it validates input locally (bad input → `invalid_input`, no API
call, no credits), calls the wrapper, and returns `{ ok, tool, data, credits, error }`.

## Conventions

- **Freshness:** results are cached by default. Pass `maxAgeMs` when you need fresh data
  (`0` = always fresh); set `CONTEXT_DEV_DEFAULT_MAX_AGE_MS` for a project-wide default.
- **Credits cost money:** one targeted call, never a loop. For >few-hundred URLs use the
  Batch API; for scheduled re-checks use Monitors (add wrapper methods when needed).
- **Tests never hit the live API** — inject a fake client into `ContextWrapper`
  (see `test/fake-client.ts`). Keep it that way.
- **Errors:** catch/branch on `ContextApiError.code`
  (`invalid_input | unauthorized | forbidden | not_found | rate_limited | server_error | timeout | connection`),
  not on SDK internals. If a call fails or returns empty, check
  https://docs.context.dev/optimization/troubleshooting before changing approach.

## Commands

```
npm test          # offline, mock-backed suite (no network, no credits)
npm run typecheck # tsc --noEmit
npm run proof     # ONE real web_search call (needs CONTEXT_DEV_API_KEY + egress to api.context.dev)
npm run build     # tsc -> dist/
```

## Network note

`npm run proof` requires outbound egress to `api.context.dev`. In restricted
environments (egress allowlist) the call returns `403 Host not in allowlist` — that's the
network policy, not a code bug. Run where the host is allowed, or add it to egress settings.
