/**
 * End-to-end mock proof: exercise the full agent path
 *   runTool(name, input) -> executor validation -> ContextWrapper -> (fake client)
 *   -> shaped, LLM-ready envelope
 * for all four tools, plus the local-rejection paths. No network, no credits.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ContextWrapper } from '../src/context/wrapper.js';
import { createToolExecutor } from '../src/agent/executor.js';
import { CONTEXT_TOOLS, toOpenAITools } from '../src/agent/tools.js';
import {
  makeFakeClient,
  searchFixture,
  scrapeMdFixture,
  extractFixture,
  crawlFixture,
} from './fake-client.js';

function executorWith(responses: Parameters<typeof makeFakeClient>[0]) {
  const fake = makeFakeClient(responses);
  const runTool = createToolExecutor(new ContextWrapper({ client: fake.client }));
  return { runTool, calls: fake.calls };
}

test('web_search: shapes results and surfaces credits', async () => {
  const { runTool } = executorWith({ search: searchFixture });
  const res = await runTool('web_search', { query: 'context.dev', numResults: 10 });

  assert.equal(res.ok, true);
  assert.equal(res.tool, 'web_search');
  const data = res.data as { query: string; results: Array<Record<string, unknown>> };
  assert.equal(data.results.length, 2);
  assert.deepEqual(data.results[0], {
    title: 'Context.dev — one API for web data',
    url: 'https://www.context.dev/',
    description: 'Scraping, crawling, search, extraction, and more.',
    relevance: 'high',
    markdown: '# Context.dev\nOne API for web data.',
  });
  // Second result had NOT_REQUESTED markdown -> markdown field omitted.
  assert.equal('markdown' in data.results[1]!, false);
  assert.deepEqual(res.credits, { consumed: 1, remaining: 999 });
});

test('web_scrape_markdown: returns markdown + page metadata', async () => {
  const { runTool } = executorWith({ webScrapeMd: scrapeMdFixture });
  const res = await runTool('web_scrape_markdown', { url: 'https://example.com' });

  assert.equal(res.ok, true);
  const data = res.data as { url: string; title?: string; markdown: string; contentLength: number };
  assert.equal(data.markdown, '# Example\nHello from the page.');
  assert.equal(data.title, 'Example Domain');
  assert.equal(data.contentLength, 27);
  assert.deepEqual(res.credits, { consumed: 1, remaining: 998 });
});

test('web_extract: passes the extracted data object through', async () => {
  const { runTool } = executorWith({ extract: extractFixture });
  const res = await runTool('web_extract', {
    url: 'https://acme.example',
    schema: { type: 'object', properties: { company: { type: 'string' } } },
  });

  assert.equal(res.ok, true);
  const data = res.data as { data: Record<string, unknown>; urlsAnalyzed: string[]; status: string };
  assert.deepEqual(data.data, { company: 'Acme', pricingTiers: ['free', 'pro'] });
  assert.deepEqual(data.urlsAnalyzed, ['https://acme.example/']);
  assert.equal(data.status, 'ok');
  assert.deepEqual(res.credits, { consumed: 10, remaining: 988 });
});

test('web_crawl: flattens pages to url + markdown', async () => {
  const { runTool } = executorWith({ webCrawlMd: crawlFixture });
  const res = await runTool('web_crawl', { url: 'https://site.example', maxPages: 5 });

  assert.equal(res.ok, true);
  const data = res.data as { pages: Array<{ url: string; markdown: string; success: boolean }> };
  assert.equal(data.pages.length, 2);
  assert.deepEqual(data.pages[1], {
    url: 'https://site.example/about',
    statusCode: 200,
    success: true,
    markdown: '# About',
  });
  assert.deepEqual(res.credits, { consumed: 2, remaining: 986 });
});

test('invalid input is rejected locally — no API call, no credits spent', async () => {
  const { runTool, calls } = executorWith({ search: searchFixture });
  const res = await runTool('web_search', {}); // missing required "query"

  assert.equal(res.ok, false);
  assert.equal(res.error?.code, 'invalid_input');
  assert.equal(res.error?.retriable, false);
  assert.equal(calls.length, 0, 'the SDK client must not be called on invalid input');
});

test('web_extract requires a schema object', async () => {
  const { runTool, calls } = executorWith({ extract: extractFixture });
  const res = await runTool('web_extract', { url: 'https://acme.example' });
  assert.equal(res.ok, false);
  assert.equal(res.error?.code, 'invalid_input');
  assert.equal(calls.length, 0);
});

test('unknown tool names are reported, not dispatched', async () => {
  const { runTool, calls } = executorWith({});
  const res = await runTool('web_teleport', { url: 'https://x' });
  assert.equal(res.ok, false);
  assert.equal(res.error?.code, 'unknown_tool');
  assert.equal(calls.length, 0);
});

test('tool catalog is stable and adaptable to OpenAI function-calling', () => {
  assert.deepEqual(
    CONTEXT_TOOLS.map((t) => t.name),
    ['web_search', 'web_scrape_markdown', 'web_extract', 'web_crawl'],
  );
  const openai = toOpenAITools();
  assert.equal(openai.length, 4);
  assert.equal(openai[0]!.type, 'function');
  assert.equal(openai[0]!.function.name, 'web_search');
  assert.equal(openai[0]!.function.parameters.required?.includes('query'), true);
});
