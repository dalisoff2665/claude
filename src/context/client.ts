/**
 * Constructs the official Context.dev SDK client.
 *
 * This is the ONLY place the raw SDK is instantiated. The SDK already implements
 * the retry policy we want: it honors `Retry-After` on 429 and retries 408/409
 * and >=500 with bounded exponential backoff (`maxRetries`, default 2), while
 * validation errors (400/422) surface immediately and are never retried. We lean
 * on that instead of hand-rolling HTTP or retry logic.
 */
import ContextDev from 'context.dev';
import { resolveConfig, type ContextConfig } from './config.js';

/** Create a fresh SDK client from an explicit or environment-derived config. */
export function createContextClient(config?: ContextConfig): ContextDev {
  const cfg = config ?? resolveConfig();
  return new ContextDev({
    apiKey: cfg.apiKey,
    baseURL: cfg.baseURL,
    maxRetries: cfg.maxRetries,
    timeout: cfg.timeoutMs,
  });
}

let sharedClient: ContextDev | undefined;

/** Lazily-created process-wide client. Safe to reuse across requests. */
export function getContextClient(): ContextDev {
  if (!sharedClient) sharedClient = createContextClient();
  return sharedClient;
}

/** Test seam: drop the cached client so the next `getContextClient()` rebuilds it. */
export function resetContextClient(): void {
  sharedClient = undefined;
}
