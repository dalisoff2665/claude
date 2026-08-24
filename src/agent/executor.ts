/**
 * Dispatches an LLM tool call to the Context.dev wrapper.
 *
 * `runTool(name, input)` validates the input against the tool's required fields
 * (bad input is rejected locally — no API call, no credits, never retried),
 * calls the matching wrapper method, and returns a compact, LLM-ready envelope.
 * Every failure comes back as a structured `error` the model can read and react
 * to, rather than a thrown exception.
 */
import { ContextApiError } from '../context/errors.js';
import { ContextWrapper, getContextWrapper } from '../context/wrapper.js';
import { CONTEXT_TOOLS_BY_NAME, type ToolName } from './tools.js';

export interface ToolCredits {
  consumed?: number;
  remaining?: number;
}

export interface ToolError {
  code: string;
  message: string;
  status?: number;
  retriable: boolean;
  retryAfterMs?: number;
}

export interface ToolResult {
  ok: boolean;
  tool: string;
  data?: unknown;
  credits?: ToolCredits;
  error?: ToolError;
}

export type ToolInput = Record<string, unknown>;

function ok(tool: string, data: unknown, credits?: ToolCredits): ToolResult {
  const result: ToolResult = { ok: true, tool, data };
  if (credits && (credits.consumed !== undefined || credits.remaining !== undefined)) {
    result.credits = credits;
  }
  return result;
}

function fail(tool: string, error: ToolError): ToolResult {
  return { ok: false, tool, error };
}

function invalid(tool: string, message: string): ToolResult {
  return fail(tool, { code: 'invalid_input', message, retriable: false });
}

function requireString(input: ToolInput, key: string): string {
  const value = input[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RangeError(`"${key}" is required and must be a non-empty string`);
  }
  return value;
}

function requireObject(input: ToolInput, key: string): Record<string, unknown> {
  const value = input[key];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RangeError(`"${key}" is required and must be an object`);
  }
  return value as Record<string, unknown>;
}

function creditsOf(res: {
  key_metadata?: { credits_consumed?: number; credits_remaining?: number };
}): ToolCredits {
  return {
    consumed: res.key_metadata?.credits_consumed,
    remaining: res.key_metadata?.credits_remaining,
  };
}

export interface ToolExecutor {
  (name: string, input?: ToolInput): Promise<ToolResult>;
}

/**
 * Build a `runTool` bound to a wrapper. When none is passed, the shared
 * env-configured wrapper is resolved lazily on the first call — so importing
 * this module (or listing tools) never requires an API key.
 */
export function createToolExecutor(wrapper?: ContextWrapper): ToolExecutor {
  return async function runTool(name: string, input: ToolInput = {}): Promise<ToolResult> {
    const activeWrapper = wrapper ?? getContextWrapper();
    if (!(name in CONTEXT_TOOLS_BY_NAME)) {
      return fail(name, {
        code: 'unknown_tool',
        message: `Unknown tool "${name}". Available: ${Object.keys(CONTEXT_TOOLS_BY_NAME).join(', ')}.`,
        retriable: false,
      });
    }
    const tool = name as ToolName;

    try {
      switch (tool) {
        case 'web_search': {
          const query = requireString(input, 'query');
          const res = await activeWrapper.search(query, {
            numResults: input.numResults as number | undefined,
            includeDomains: input.includeDomains as string[] | undefined,
            excludeDomains: input.excludeDomains as string[] | undefined,
            freshness: input.freshness as never,
            scrapeResults: input.scrapeResults as boolean | undefined,
            maxAgeMs: input.maxAgeMs as number | undefined,
          });
          const data = {
            query: res.query,
            results: res.results.map((r) => ({
              title: r.title,
              url: r.url,
              description: r.description,
              relevance: r.relevance,
              ...(r.markdown?.code === 'SUCCESS' && r.markdown.markdown
                ? { markdown: r.markdown.markdown }
                : {}),
            })),
          };
          return ok(tool, data, creditsOf(res));
        }

        case 'web_scrape_markdown': {
          const url = requireString(input, 'url');
          const res = await activeWrapper.scrapeMarkdown(url, {
            useMainContentOnly: input.useMainContentOnly as boolean | undefined,
            includeLinks: input.includeLinks as boolean | undefined,
            includeImages: input.includeImages as boolean | undefined,
            maxAgeMs: input.maxAgeMs as number | undefined,
          });
          const data = {
            url: res.url,
            finalUrl: res.metadata.finalUrl,
            title: res.metadata.title,
            description: res.metadata.description,
            contentLength: res.contentLength,
            markdown: res.markdown,
          };
          return ok(tool, data, creditsOf(res));
        }

        case 'web_extract': {
          const url = requireString(input, 'url');
          const schema = requireObject(input, 'schema');
          const res = await activeWrapper.extract(url, schema, {
            instructions: input.instructions as string | undefined,
            maxPages: input.maxPages as number | undefined,
            maxDepth: input.maxDepth as number | undefined,
            factCheck: input.factCheck as boolean | undefined,
            maxAgeMs: input.maxAgeMs as number | undefined,
          });
          const data = {
            url: res.url,
            status: res.status,
            data: res.data,
            urlsAnalyzed: res.urls_analyzed,
            pagesSucceeded: res.metadata.numSucceeded,
          };
          return ok(tool, data, creditsOf(res));
        }

        case 'web_crawl': {
          const url = requireString(input, 'url');
          const res = await activeWrapper.crawl(url, {
            maxPages: input.maxPages as number | undefined,
            maxDepth: input.maxDepth as number | undefined,
            urlRegex: input.urlRegex as string | undefined,
            includeLinks: input.includeLinks as boolean | undefined,
            maxAgeMs: input.maxAgeMs as number | undefined,
          });
          const data = {
            startUrl: url,
            summary: res.metadata,
            pages: res.results.map((p) => ({
              url: p.metadata.finalUrl || p.metadata.sourceUrl,
              statusCode: p.metadata.statusCode,
              success: p.metadata.success,
              markdown: p.markdown,
            })),
          };
          return ok(tool, data, creditsOf(res));
        }
      }
    } catch (err) {
      if (err instanceof RangeError) return invalid(tool, err.message);
      if (err instanceof ContextApiError) {
        return fail(tool, {
          code: err.code,
          message: err.message,
          status: err.status,
          retriable: err.retriable,
          ...(err.retryAfterMs !== undefined ? { retryAfterMs: err.retryAfterMs } : {}),
        });
      }
      return fail(tool, {
        code: 'unknown',
        message: err instanceof Error ? err.message : String(err),
        retriable: false,
      });
    }

    // Unreachable: the switch is exhaustive over ToolName.
    return fail(tool, { code: 'unknown', message: 'Unhandled tool', retriable: false });
  };
}

/** Convenience: a `runTool` bound to the shared wrapper. */
export const runTool: ToolExecutor = createToolExecutor();
