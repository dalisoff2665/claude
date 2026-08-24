/**
 * Wrapper unit tests: parameter mapping, credit reporting, and error
 * normalization. All offline — a fake client stands in for the SDK.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimitError, BadRequestError } from 'context.dev';

import { ContextWrapper } from '../src/context/wrapper.js';
import { ContextApiError, normalizeError } from '../src/context/errors.js';
import {
  makeFakeClient,
  searchFixture,
  scrapeMdFixture,
  extractFixture,
  crawlFixture,
  type RecordedCall,
} from './fake-client.js';

function paramsOf(calls: RecordedCall[]): Record<string, unknown> {
  assert.equal(calls.length, 1, 'expected exactly one SDK call');
  return calls[0]!.params as Record<string, unknown>;
}

test('search maps options onto the SDK body (incl. markdownOptions + maxAgeMs)', async () => {
  const { client, calls } = makeFakeClient({ search: searchFixture });
  const wrapper = new ContextWrapper({ client });

  await wrapper.search('hello world', {
    numResults: 20,
    includeDomains: ['arxiv.org'],
    excludeDomains: ['pinterest.com'],
    freshness: 'last_week',
    scrapeResults: true,
    maxAgeMs: 0,
  });

  assert.deepEqual(paramsOf(calls), {
    query: 'hello world',
    numResults: 20,
    includeDomains: ['arxiv.org'],
    excludeDomains: ['pinterest.com'],
    freshness: 'last_week',
    markdownOptions: { enabled: true, maxAgeMs: 0 },
  });
});

test('search without scrapeResults omits markdownOptions', async () => {
  const { client, calls } = makeFakeClient({ search: searchFixture });
  await new ContextWrapper({ client }).search('just a query');
  assert.deepEqual(paramsOf(calls), { query: 'just a query' });
});

test('scrapeMarkdown maps url, maxAgeMs, and includeHtml -> includeHTML', async () => {
  const { client, calls } = makeFakeClient({ webScrapeMd: scrapeMdFixture });
  await new ContextWrapper({ client }).scrapeMarkdown('https://example.com', {
    maxAgeMs: 0,
    useMainContentOnly: true,
    includeHtml: true,
  });
  assert.deepEqual(paramsOf(calls), {
    url: 'https://example.com',
    maxAgeMs: 0,
    useMainContentOnly: true,
    includeHTML: true,
  });
});

test('extract maps url, schema, and crawl bounds', async () => {
  const { client, calls } = makeFakeClient({ extract: extractFixture });
  const schema = { type: 'object', properties: { company: { type: 'string' } } };
  await new ContextWrapper({ client }).extract('https://acme.example', schema, {
    instructions: 'Find the company name',
    maxPages: 3,
    maxDepth: 1,
  });
  assert.deepEqual(paramsOf(calls), {
    url: 'https://acme.example',
    schema,
    instructions: 'Find the company name',
    maxPages: 3,
    maxDepth: 1,
  });
});

test('crawl maps url, urlRegex, and page bounds', async () => {
  const { client, calls } = makeFakeClient({ webCrawlMd: crawlFixture });
  await new ContextWrapper({ client }).crawl('https://site.example', {
    maxPages: 25,
    urlRegex: '^https://site\\.example/docs',
    includeLinks: true,
  });
  assert.deepEqual(paramsOf(calls), {
    url: 'https://site.example',
    maxPages: 25,
    urlRegex: '^https://site\\.example/docs',
    includeLinks: true,
  });
});

test('defaultMaxAgeMs is applied when a call omits maxAgeMs', async () => {
  const { client, calls } = makeFakeClient({ webScrapeMd: scrapeMdFixture });
  await new ContextWrapper({ client, defaultMaxAgeMs: 60_000 }).scrapeMarkdown('https://example.com');
  assert.deepEqual(paramsOf(calls), { url: 'https://example.com', maxAgeMs: 60_000 });
});

test('onCredits reports credits_consumed / credits_remaining from key_metadata', async () => {
  const events: Array<{ endpoint: string; consumed?: number; remaining?: number }> = [];
  const { client } = makeFakeClient({ search: searchFixture });
  const wrapper = new ContextWrapper({ client, onCredits: (e) => events.push(e) });

  await wrapper.search('hi');

  assert.deepEqual(events, [{ endpoint: 'web/search', consumed: 1, remaining: 999 }]);
});

test('normalizeError maps a 429 to a retriable rate_limited error with retryAfterMs', () => {
  const sdkError = new RateLimitError(
    429,
    { key_metadata: { credits_remaining: 5 } },
    'Too Many Requests',
    new Headers({ 'retry-after': '2' }),
  );
  const err = normalizeError(sdkError);
  assert.ok(err instanceof ContextApiError);
  assert.equal(err.code, 'rate_limited');
  assert.equal(err.retriable, true);
  assert.equal(err.status, 429);
  assert.equal(err.retryAfterMs, 2000);
  assert.equal(err.creditsRemaining, 5);
});

test('normalizeError maps a 400 to a non-retriable invalid_input error', () => {
  const sdkError = new BadRequestError(400, {}, 'Bad Request', new Headers());
  const err = normalizeError(sdkError);
  assert.equal(err.code, 'invalid_input');
  assert.equal(err.retriable, false);
  assert.equal(err.status, 400);
});

test('the wrapper rethrows SDK errors as ContextApiError', async () => {
  const sdkError = new BadRequestError(400, {}, 'Bad Request', new Headers());
  const { client } = makeFakeClient({ throwError: sdkError });
  const wrapper = new ContextWrapper({ client });

  await assert.rejects(wrapper.search('boom'), (err: unknown) => {
    assert.ok(err instanceof ContextApiError);
    assert.equal((err as ContextApiError).code, 'invalid_input');
    return true;
  });
});
