/**
 * Normalizes SDK errors into a single, stable shape.
 *
 * The SDK throws typed `APIError` subclasses. We translate them into one
 * `ContextApiError` carrying a stable `code`, whether the failure is `retriable`,
 * and (for 429) a parsed `retryAfterMs`. Callers — especially the agent tool
 * executor — branch on this instead of importing SDK internals.
 */
import {
  APIError,
  APIConnectionTimeoutError,
  APIConnectionError,
  RateLimitError,
  BadRequestError,
  AuthenticationError,
  PermissionDeniedError,
  NotFoundError,
  UnprocessableEntityError,
} from 'context.dev';

export type ContextErrorCode =
  | 'invalid_input' // 400 / 422 — bad params; never retried
  | 'unauthorized' // 401 — bad or missing key
  | 'forbidden' // 403 — key lacks permission / plan
  | 'not_found' // 404
  | 'rate_limited' // 429 — honor retryAfterMs
  | 'server_error' // >= 500
  | 'timeout' // request timed out
  | 'connection' // could not reach the API (DNS, egress policy, TLS, offline)
  | 'unknown';

export interface ContextApiErrorInit {
  code: ContextErrorCode;
  message: string;
  retriable: boolean;
  status?: number;
  retryAfterMs?: number;
  creditsRemaining?: number;
  cause?: unknown;
}

/** Single error type surfaced by the wrapper for every failed Context.dev call. */
export class ContextApiError extends Error {
  readonly code: ContextErrorCode;
  readonly retriable: boolean;
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly creditsRemaining?: number;

  constructor(init: ContextApiErrorInit) {
    super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = 'ContextApiError';
    this.code = init.code;
    this.retriable = init.retriable;
    this.status = init.status;
    this.retryAfterMs = init.retryAfterMs;
    this.creditsRemaining = init.creditsRemaining;
  }

  /** Compact, safe-to-serialize view for tool results and logs. */
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      retriable: this.retriable,
      ...(this.retryAfterMs !== undefined ? { retryAfterMs: this.retryAfterMs } : {}),
      ...(this.creditsRemaining !== undefined ? { creditsRemaining: this.creditsRemaining } : {}),
    };
  }
}

/** Parse a `Retry-After` header (delta-seconds or HTTP-date) into milliseconds. */
function parseRetryAfterMs(headers: Headers | undefined): number | undefined {
  const raw = headers?.get?.('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(raw);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

function creditsRemainingFrom(error: unknown): number | undefined {
  const body = (error as { error?: unknown } | undefined)?.error as
    | { key_metadata?: { credits_remaining?: number } }
    | undefined;
  return body?.key_metadata?.credits_remaining;
}

/**
 * Translate any thrown value into a {@link ContextApiError}. `ContextApiError`
 * passes through unchanged so this is idempotent across wrapper layers.
 */
export function normalizeError(err: unknown): ContextApiError {
  if (err instanceof ContextApiError) return err;

  if (err instanceof APIError) {
    const status = err.status;
    const creditsRemaining = creditsRemainingFrom(err);
    const base = { status, message: err.message, cause: err, creditsRemaining };

    if (err instanceof RateLimitError) {
      return new ContextApiError({
        ...base,
        code: 'rate_limited',
        retriable: true,
        retryAfterMs: parseRetryAfterMs(err.headers),
      });
    }
    if (err instanceof BadRequestError || err instanceof UnprocessableEntityError) {
      return new ContextApiError({ ...base, code: 'invalid_input', retriable: false });
    }
    if (err instanceof AuthenticationError) {
      return new ContextApiError({ ...base, code: 'unauthorized', retriable: false });
    }
    if (err instanceof PermissionDeniedError) {
      return new ContextApiError({ ...base, code: 'forbidden', retriable: false });
    }
    if (err instanceof NotFoundError) {
      return new ContextApiError({ ...base, code: 'not_found', retriable: false });
    }
    if (err instanceof APIConnectionTimeoutError) {
      return new ContextApiError({ ...base, code: 'timeout', retriable: true });
    }
    if (err instanceof APIConnectionError) {
      return new ContextApiError({ ...base, code: 'connection', retriable: true });
    }
    if (typeof status === 'number' && status >= 500) {
      return new ContextApiError({ ...base, code: 'server_error', retriable: true });
    }
    return new ContextApiError({ ...base, code: 'unknown', retriable: false });
  }

  return new ContextApiError({
    code: 'unknown',
    message: err instanceof Error ? err.message : String(err),
    retriable: false,
    cause: err,
  });
}
