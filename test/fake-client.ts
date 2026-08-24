/**
 * A fake Context.dev client + typed response fixtures for tests.
 *
 * Fixtures are annotated with the SDK's own response types, so if any fixture
 * drifts from the real API shape the test suite fails to compile. No test ever
 * touches the network or spends credits.
 */
import type ContextDev from 'context.dev';
import type { ContextClientLike } from '../src/context/wrapper.js';

export interface RecordedCall {
  method: 'search' | 'webScrapeMd' | 'extract' | 'webCrawlMd';
  params: unknown;
}

export interface FakeClientResponses {
  search?: ContextDev.WebSearchResponse;
  webScrapeMd?: ContextDev.WebWebScrapeMdResponse;
  extract?: ContextDev.WebExtractResponse;
  webCrawlMd?: ContextDev.WebWebCrawlMdResponse;
  /** When set, every method rejects with this instead of resolving. */
  throwError?: unknown;
}

export function makeFakeClient(responses: FakeClientResponses = {}): {
  client: ContextClientLike;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const handler =
    <T>(method: RecordedCall['method'], response: T | undefined) =>
    (params: unknown): Promise<T> => {
      calls.push({ method, params });
      if (responses.throwError !== undefined) return Promise.reject(responses.throwError);
      return Promise.resolve(response as T);
    };

  const client: ContextClientLike = {
    web: {
      search: handler('search', responses.search),
      webScrapeMd: handler('webScrapeMd', responses.webScrapeMd),
      extract: handler('extract', responses.extract),
      webCrawlMd: handler('webCrawlMd', responses.webCrawlMd),
    },
  };
  return { client, calls };
}

export const searchFixture: ContextDev.WebSearchResponse = {
  query: 'context.dev',
  results: [
    {
      title: 'Context.dev — one API for web data',
      url: 'https://www.context.dev/',
      description: 'Scraping, crawling, search, extraction, and more.',
      relevance: 'high',
      markdown: { code: 'SUCCESS', markdown: '# Context.dev\nOne API for web data.' },
    },
    {
      title: 'Docs',
      url: 'https://docs.context.dev/',
      description: 'API reference and guides.',
      relevance: 'medium',
      markdown: { code: 'NOT_REQUESTED', markdown: null },
    },
  ],
  key_metadata: { credits_consumed: 1, credits_remaining: 999 },
};

export const scrapeMdFixture: ContextDev.WebWebScrapeMdResponse = {
  contentLength: 27,
  markdown: '# Example\nHello from the page.',
  metadata: {
    finalUrl: 'https://example.com/',
    sourceUrl: 'https://example.com/',
    title: 'Example Domain',
    description: 'An example page.',
  },
  success: true,
  url: 'https://example.com/',
  key_metadata: { credits_consumed: 1, credits_remaining: 998 },
};

export const extractFixture: ContextDev.WebExtractResponse = {
  data: { company: 'Acme', pricingTiers: ['free', 'pro'] },
  metadata: {
    maxCrawlDepth: 0,
    numBlocked: 0,
    numFailed: 0,
    numSkipped: 0,
    numSucceeded: 1,
    numUrls: 1,
  },
  status: 'ok',
  url: 'https://acme.example/',
  urls_analyzed: ['https://acme.example/'],
  key_metadata: { credits_consumed: 10, credits_remaining: 988 },
};

export const crawlFixture: ContextDev.WebWebCrawlMdResponse = {
  metadata: { maxCrawlDepth: 1, numFailed: 0, numSkipped: 0, numSucceeded: 2, numUrls: 2 },
  results: [
    {
      markdown: '# Home',
      metadata: {
        crawlDepth: 0,
        finalUrl: 'https://site.example/',
        sourceUrl: 'https://site.example/',
        statusCode: 200,
        success: true,
        title: 'Home',
        url: 'https://site.example/',
      },
    },
    {
      markdown: '# About',
      metadata: {
        crawlDepth: 1,
        finalUrl: 'https://site.example/about',
        sourceUrl: 'https://site.example/about',
        statusCode: 200,
        success: true,
        title: 'About',
        url: 'https://site.example/about',
      },
    },
  ],
  key_metadata: { credits_consumed: 2, credits_remaining: 986 },
};
