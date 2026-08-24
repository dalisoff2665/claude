/**
 * LLM-facing tool definitions for Context.dev web data.
 *
 * These are the "web-data tools" an agent calls. Schemas are expressed in the
 * Anthropic tool-use shape (`name` / `description` / `input_schema`) and adapted
 * to OpenAI function-calling via {@link toOpenAITools}. The executor
 * (`./executor.ts`) validates each call's input against `required` and dispatches
 * it to the single Context.dev wrapper.
 */

export type ToolName = 'web_search' | 'web_scrape_markdown' | 'web_extract' | 'web_crawl';

export interface JSONSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface AgentToolSpec {
  name: ToolName;
  description: string;
  input_schema: JSONSchema;
}

export const WEB_SEARCH_TOOL: AgentToolSpec = {
  name: 'web_search',
  description:
    'Search the web and get back ranked, LLM-ready results (title, url, snippet, relevance). ' +
    'Use for current events, discovery, or finding source URLs to scrape next. ' +
    'Set scrapeResults=true to also pull each result page as Markdown in one call (costs more).',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Search query. Supports Google-style operators (site:, -site:, inurl:, intitle:, quotes, OR).',
      },
      numResults: {
        type: 'integer',
        minimum: 10,
        maximum: 100,
        description: 'How many results to return (10–100). Defaults to 10.',
      },
      includeDomains: {
        type: 'array',
        items: { type: 'string' },
        description: 'Allowlist — only return results from these domains.',
      },
      excludeDomains: {
        type: 'array',
        items: { type: 'string' },
        description: 'Blocklist — drop results from these domains.',
      },
      freshness: {
        type: 'string',
        enum: ['last_24_hours', 'last_week', 'last_month', 'last_year'],
        description: 'Restrict results to content published within this window.',
      },
      scrapeResults: {
        type: 'boolean',
        description: 'Also scrape each result to Markdown. Off by default to keep search fast.',
      },
      maxAgeMs: {
        type: 'integer',
        minimum: 0,
        description: 'Cache TTL (ms) for scraped result Markdown. Set 0 to force fresh data.',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
};

export const WEB_SCRAPE_MARKDOWN_TOOL: AgentToolSpec = {
  name: 'web_scrape_markdown',
  description:
    'Turn one URL into clean, LLM-ready Markdown. Use when you already have a specific page to read.',
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Full URL to scrape (must include http:// or https://).',
      },
      useMainContentOnly: {
        type: 'boolean',
        description: 'Strip nav, header, footer, and sidebars — keep only the main article.',
      },
      includeLinks: { type: 'boolean', description: 'Preserve hyperlinks in the Markdown.' },
      includeImages: { type: 'boolean', description: 'Include image references in the Markdown.' },
      maxAgeMs: {
        type: 'integer',
        minimum: 0,
        description: 'Cache TTL (ms). Omit for the default (1 day); set 0 to force a fresh scrape.',
      },
    },
    required: ['url'],
    additionalProperties: false,
  },
};

export const WEB_EXTRACT_TOOL: AgentToolSpec = {
  name: 'web_extract',
  description:
    'Extract structured data from a page (and, if needed, a few linked pages) into your own JSON ' +
    'Schema. Use when you need specific fields — prices, specs, contact info — not prose.',
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Starting URL to crawl and extract from (must include http:// or https://).',
      },
      schema: {
        type: 'object',
        description:
          'JSON Schema describing the object to return. The result is coerced to match this.',
      },
      instructions: {
        type: 'string',
        description: 'Optional guidance on which facts to prioritize or how to interpret fields.',
      },
      maxPages: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        description: 'Max pages to analyze (hard cap 50; defaults to 5).',
      },
      maxDepth: {
        type: 'integer',
        minimum: 0,
        description: 'Max link depth from the start URL (0 = only the start page).',
      },
      factCheck: {
        type: 'boolean',
        description: 'Require every value to be grounded in page facts (no inference).',
      },
      maxAgeMs: {
        type: 'integer',
        minimum: 0,
        description: 'Cache TTL (ms). Omit for the default (7 days); set 0 to force fresh data.',
      },
    },
    required: ['url', 'schema'],
    additionalProperties: false,
  },
};

export const WEB_CRAWL_TOOL: AgentToolSpec = {
  name: 'web_crawl',
  description:
    'Crawl a site starting from a URL and return clean Markdown for every page reached. ' +
    'Use to ingest docs or a section of a site. Bound the crawl with maxPages / maxDepth / urlRegex.',
  input_schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Starting URL for the crawl (must include http:// or https://).',
      },
      maxPages: {
        type: 'integer',
        minimum: 1,
        maximum: 500,
        description: 'Max pages to crawl (hard cap 500). Keep small to control credit spend.',
      },
      maxDepth: {
        type: 'integer',
        minimum: 0,
        description: 'Max link depth from the start URL (0 = only the start page).',
      },
      urlRegex: {
        type: 'string',
        description: 'Only follow/scrape URLs matching this regex (e.g. "^https://docs\\\\.").',
      },
      includeLinks: { type: 'boolean', description: 'Preserve hyperlinks in the Markdown.' },
      maxAgeMs: {
        type: 'integer',
        minimum: 0,
        description: 'Cache TTL (ms). Omit for the default (1 day); set 0 to force fresh data.',
      },
    },
    required: ['url'],
    additionalProperties: false,
  },
};

/** All Context.dev agent tools, in a stable order. */
export const CONTEXT_TOOLS: AgentToolSpec[] = [
  WEB_SEARCH_TOOL,
  WEB_SCRAPE_MARKDOWN_TOOL,
  WEB_EXTRACT_TOOL,
  WEB_CRAWL_TOOL,
];

export const CONTEXT_TOOLS_BY_NAME: Record<ToolName, AgentToolSpec> = {
  web_search: WEB_SEARCH_TOOL,
  web_scrape_markdown: WEB_SCRAPE_MARKDOWN_TOOL,
  web_extract: WEB_EXTRACT_TOOL,
  web_crawl: WEB_CRAWL_TOOL,
};

/** OpenAI function-calling shape, for agents that expect that format. */
export interface OpenAIToolSpec {
  type: 'function';
  function: { name: string; description: string; parameters: JSONSchema };
}

/** Adapt the Anthropic-shaped specs to OpenAI's `tools` array. */
export function toOpenAITools(tools: AgentToolSpec[] = CONTEXT_TOOLS): OpenAIToolSpec[] {
  return tools.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}
