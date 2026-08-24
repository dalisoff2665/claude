/**
 * The single server-side wrapper for Context.dev.
 *
 * Every Context.dev call in this project goes through here — nothing else imports
 * the SDK client directly. That keeps auth, retries, error normalization, credit
 * accounting, and `maxAgeMs` (cache freshness) policy in one auditable place.
 *
 * Endpoints wired (the four the agent needs):
 *   - search         -> POST /web/search           (web search)
 *   - scrapeMarkdown -> GET  /web/scrape/markdown   (one URL -> Markdown)
 *   - extract        -> POST /web/extract           (structured data via JSON Schema)
 *   - crawl          -> POST /web/crawl             (site -> Markdown per page)
 *
 * Docs (source of truth): https://docs.context.dev
 *   /api-reference/web-scraping/search
 *   /api-reference/web-scraping/markdown
 *   /api-reference/web-extraction/extract
 *   /api-reference/web-scraping/crawl
 */
import type ContextDev from 'context.dev';
import { createContextClient } from './client.js';
import type { ContextConfig } from './config.js';
import { normalizeError } from './errors.js';

/** ISO 3166-1 alpha-2 country code accepted by the scrape/crawl endpoints. */
export type CountryCode = NonNullable<ContextDev.WebWebScrapeMdParams['country']>;
/** ISO 3166-1 alpha-2 country code accepted by the search endpoint. */
export type SearchCountryCode = NonNullable<ContextDev.WebSearchParams['country']>;
export type SearchFreshness = NonNullable<ContextDev.WebSearchParams['freshness']>;

/**
 * Minimal shape of the SDK's `web` resource that the wrapper depends on.
 * Real `ContextDev` clients satisfy this; tests pass a fake that satisfies it
 * too, so no automated test ever touches the live API (or spends credits).
 */
export interface WebResourceLike {
  search(body: ContextDev.WebSearchParams): Promise<ContextDev.WebSearchResponse>;
  webScrapeMd(query: ContextDev.WebWebScrapeMdParams): Promise<ContextDev.WebWebScrapeMdResponse>;
  extract(body: ContextDev.WebExtractParams): Promise<ContextDev.WebExtractResponse>;
  webCrawlMd(body: ContextDev.WebWebCrawlMdParams): Promise<ContextDev.WebWebCrawlMdResponse>;
}
export interface ContextClientLike {
  web: WebResourceLike;
}

export interface CreditEvent {
  endpoint: string;
  consumed?: number;
  remaining?: number;
}

export interface ContextWrapperOptions {
  /** Inject a client (or a fake for tests). Defaults to a client built from `config`/env. */
  client?: ContextClientLike;
  /** Config used only when `client` is not supplied. */
  config?: ContextConfig;
  /** Default cache TTL (ms) applied when a call omits `maxAgeMs`. */
  defaultMaxAgeMs?: number;
  /** Called after every successful call with credit usage from `key_metadata`. */
  onCredits?: (event: CreditEvent) => void;
}

export interface SearchOptions {
  /** Number of results to return (10–100). Defaults to 10 server-side. */
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  freshness?: SearchFreshness;
  country?: SearchCountryCode;
  /** Expand the query into parallel variants for broader recall. */
  queryFanout?: boolean;
  /** Also scrape each result to Markdown (costs more; off by default). */
  scrapeResults?: boolean;
  /** Cache TTL (ms) for the per-result Markdown scrape. 0 = always fresh. */
  maxAgeMs?: number;
  tags?: string[];
  timeoutMs?: number;
}

export interface ScrapeMarkdownOptions {
  /** Cache TTL (ms). Omit for the endpoint default (1 day); 0 = always fresh. */
  maxAgeMs?: number;
  useMainContentOnly?: boolean;
  includeLinks?: boolean;
  includeImages?: boolean;
  /** Also return the source HTML the Markdown was converted from. */
  includeHtml?: boolean;
  country?: CountryCode;
  tags?: string[];
  timeoutMs?: number;
}

export interface ExtractOptions {
  /** Guidance on which facts to prioritize or how to interpret schema fields. */
  instructions?: string;
  /** Max pages to analyze (hard cap 50; default 5). */
  maxPages?: number;
  /** Max link depth from the start URL (0 = only the start page). */
  maxDepth?: number;
  /** Require every value to be grounded in page facts (no inference). */
  factCheck?: boolean;
  /** Cache TTL (ms). Omit for the endpoint default (7 days); 0 = always fresh. */
  maxAgeMs?: number;
  tags?: string[];
  timeoutMs?: number;
}

export interface CrawlOptions {
  /** Max pages to crawl (hard cap 500). */
  maxPages?: number;
  /** Max link depth from the start URL (0 = only the start page). */
  maxDepth?: number;
  /** Only follow/scrape URLs matching this regex. */
  urlRegex?: string;
  followSubdomains?: boolean;
  useMainContentOnly?: boolean;
  includeLinks?: boolean;
  includeImages?: boolean;
  /** Cache TTL (ms). Omit for the endpoint default (1 day); 0 = always fresh. */
  maxAgeMs?: number;
  tags?: string[];
  timeoutMs?: number;
}

type WithKeyMetadata = { key_metadata?: { credits_consumed?: number; credits_remaining?: number } };

export class ContextWrapper {
  private readonly client: ContextClientLike;
  private readonly defaultMaxAgeMs?: number;
  private readonly onCredits?: (event: CreditEvent) => void;

  constructor(options: ContextWrapperOptions = {}) {
    this.client = options.client ?? (createContextClient(options.config) as ContextClientLike);
    this.defaultMaxAgeMs = options.defaultMaxAgeMs ?? options.config?.defaultMaxAgeMs;
    this.onCredits = options.onCredits;
  }

  private resolveMaxAge(explicit?: number): number | undefined {
    return explicit ?? this.defaultMaxAgeMs;
  }

  /** Run one SDK call: report credits on success, normalize the error on failure. */
  private async run<T extends WithKeyMetadata>(
    endpoint: string,
    call: () => Promise<T>,
  ): Promise<T> {
    try {
      const result = await call();
      this.onCredits?.({
        endpoint,
        consumed: result.key_metadata?.credits_consumed,
        remaining: result.key_metadata?.credits_remaining,
      });
      return result;
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /** Web search — ranked, LLM-ready results. Optionally scrape each to Markdown. */
  search(query: string, options: SearchOptions = {}): Promise<ContextDev.WebSearchResponse> {
    const body: ContextDev.WebSearchParams = { query };
    if (options.numResults !== undefined) body.numResults = options.numResults;
    if (options.includeDomains) body.includeDomains = options.includeDomains;
    if (options.excludeDomains) body.excludeDomains = options.excludeDomains;
    if (options.freshness) body.freshness = options.freshness;
    if (options.country) body.country = options.country;
    if (options.queryFanout !== undefined) body.queryFanout = options.queryFanout;
    if (options.tags) body.tags = options.tags;
    if (options.timeoutMs !== undefined) body.timeoutMS = options.timeoutMs;
    if (options.scrapeResults) {
      const maxAgeMs = this.resolveMaxAge(options.maxAgeMs);
      body.markdownOptions = { enabled: true, ...(maxAgeMs !== undefined ? { maxAgeMs } : {}) };
    }
    return this.run('web/search', () => this.client.web.search(body));
  }

  /** Scrape a single URL into clean Markdown. */
  scrapeMarkdown(
    url: string,
    options: ScrapeMarkdownOptions = {},
  ): Promise<ContextDev.WebWebScrapeMdResponse> {
    const query: ContextDev.WebWebScrapeMdParams = { url };
    const maxAgeMs = this.resolveMaxAge(options.maxAgeMs);
    if (maxAgeMs !== undefined) query.maxAgeMs = maxAgeMs;
    if (options.useMainContentOnly !== undefined) query.useMainContentOnly = options.useMainContentOnly;
    if (options.includeLinks !== undefined) query.includeLinks = options.includeLinks;
    if (options.includeImages !== undefined) query.includeImages = options.includeImages;
    if (options.includeHtml !== undefined) query.includeHTML = options.includeHtml;
    if (options.country) query.country = options.country;
    if (options.tags) query.tags = options.tags;
    if (options.timeoutMs !== undefined) query.timeoutMS = options.timeoutMs;
    return this.run('web/scrape/markdown', () => this.client.web.webScrapeMd(query));
  }

  /** Extract structured data into a caller-provided JSON Schema. */
  extract(
    url: string,
    schema: Record<string, unknown>,
    options: ExtractOptions = {},
  ): Promise<ContextDev.WebExtractResponse> {
    const body: ContextDev.WebExtractParams = { url, schema };
    if (options.instructions) body.instructions = options.instructions;
    if (options.maxPages !== undefined) body.maxPages = options.maxPages;
    if (options.maxDepth !== undefined) body.maxDepth = options.maxDepth;
    if (options.factCheck !== undefined) body.factCheck = options.factCheck;
    const maxAgeMs = this.resolveMaxAge(options.maxAgeMs);
    if (maxAgeMs !== undefined) body.maxAgeMs = maxAgeMs;
    if (options.tags) body.tags = options.tags;
    if (options.timeoutMs !== undefined) body.timeoutMS = options.timeoutMs;
    return this.run('web/extract', () => this.client.web.extract(body));
  }

  /** Crawl a site and return clean Markdown for every page reached. */
  crawl(url: string, options: CrawlOptions = {}): Promise<ContextDev.WebWebCrawlMdResponse> {
    const body: ContextDev.WebWebCrawlMdParams = { url };
    if (options.maxPages !== undefined) body.maxPages = options.maxPages;
    if (options.maxDepth !== undefined) body.maxDepth = options.maxDepth;
    if (options.urlRegex) body.urlRegex = options.urlRegex;
    if (options.followSubdomains !== undefined) body.followSubdomains = options.followSubdomains;
    if (options.useMainContentOnly !== undefined) body.useMainContentOnly = options.useMainContentOnly;
    if (options.includeLinks !== undefined) body.includeLinks = options.includeLinks;
    if (options.includeImages !== undefined) body.includeImages = options.includeImages;
    const maxAgeMs = this.resolveMaxAge(options.maxAgeMs);
    if (maxAgeMs !== undefined) body.maxAgeMs = maxAgeMs;
    if (options.tags) body.tags = options.tags;
    if (options.timeoutMs !== undefined) body.timeoutMS = options.timeoutMs;
    return this.run('web/crawl', () => this.client.web.webCrawlMd(body));
  }
}

let sharedWrapper: ContextWrapper | undefined;

/** Lazily-created process-wide wrapper backed by the env-configured client. */
export function getContextWrapper(): ContextWrapper {
  if (!sharedWrapper) sharedWrapper = new ContextWrapper();
  return sharedWrapper;
}

/** Test seam: drop the cached wrapper. */
export function resetContextWrapper(): void {
  sharedWrapper = undefined;
}
