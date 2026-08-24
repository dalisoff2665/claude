/**
 * Resolves Context.dev configuration from the environment.
 *
 * The API key is a server-side secret. It is read from `CONTEXT_DEV_API_KEY`
 * and never hardcoded, logged, or shipped to a browser bundle. Keep this module
 * (and everything under `src/context`) on the server only.
 */

export interface ContextConfig {
  /** Context.dev API key (server-side secret). */
  apiKey: string;
  /** REST base URL. Defaults to https://api.context.dev/v1. */
  baseURL: string;
  /**
   * Max automatic retries the SDK performs for retriable failures
   * (408/409/429 and >=500). Validation errors (400/422) are never retried.
   */
  maxRetries: number;
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
  /**
   * Optional default cache TTL (ms) applied to cacheable reads when the caller
   * does not pass its own `maxAgeMs`. Undefined = use each endpoint's own default.
   */
  defaultMaxAgeMs?: number;
}

const DEFAULT_BASE_URL = 'https://api.context.dev/v1';
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 60_000;

export interface ResolveConfigOptions {
  /** Environment source. Defaults to `process.env`. Injectable for tests. */
  env?: NodeJS.ProcessEnv;
  /** Explicit overrides that win over the environment. */
  overrides?: Partial<ContextConfig>;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function parseOptionalInt(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

/**
 * Build a validated {@link ContextConfig}. Throws a clear error when the API key
 * is missing so failures surface at startup rather than on the first request.
 */
export function resolveConfig(options: ResolveConfigOptions = {}): ContextConfig {
  const env = options.env ?? process.env;
  const overrides = options.overrides ?? {};

  const apiKey = overrides.apiKey ?? env.CONTEXT_DEV_API_KEY ?? '';
  if (!apiKey) {
    throw new Error(
      'CONTEXT_DEV_API_KEY is not set. Add it to your environment or .env file ' +
        '(see .env.example). Rotate keys at https://www.context.dev/dashboard/api-keys.',
    );
  }

  return {
    apiKey,
    baseURL: overrides.baseURL ?? env.CONTEXT_DEV_BASE_URL ?? DEFAULT_BASE_URL,
    maxRetries:
      overrides.maxRetries ?? parsePositiveInt(env.CONTEXT_DEV_MAX_RETRIES, DEFAULT_MAX_RETRIES),
    timeoutMs:
      overrides.timeoutMs ?? parsePositiveInt(env.CONTEXT_DEV_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    defaultMaxAgeMs:
      overrides.defaultMaxAgeMs ?? parseOptionalInt(env.CONTEXT_DEV_DEFAULT_MAX_AGE_MS),
  };
}
