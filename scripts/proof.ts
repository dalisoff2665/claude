/**
 * Live end-to-end proof: one real Context.dev call through the agent tool layer.
 *
 *   npm run proof
 *
 * Makes exactly ONE `web_search` call (1 credit) via `runTool` -> the wrapper ->
 * the official SDK -> https://api.context.dev/v1/web/search, then prints the
 * shaped result and credit usage. This is intentionally a single targeted call,
 * not a loop — every real call costs credits.
 *
 * Requires CONTEXT_DEV_API_KEY in the environment (or in .env; `npm run proof`
 * loads .env automatically).
 */
import { createToolExecutor } from '../src/agent/executor.js';
import { ContextWrapper } from '../src/context/wrapper.js';

// Defensive: load .env if present, in case this file is run without the npm script.
try {
  if (typeof process.loadEnvFile === 'function') process.loadEnvFile('.env');
} catch {
  /* no .env file — rely on the ambient environment */
}

const QUERY = process.argv.slice(2).join(' ').trim() || 'what is context.dev';

async function main(): Promise<void> {
  if (!process.env.CONTEXT_DEV_API_KEY) {
    console.error(
      'CONTEXT_DEV_API_KEY is not set.\n' +
        'Copy .env.example to .env and paste your key (or export it), then re-run `npm run proof`.',
    );
    process.exitCode = 1;
    return;
  }

  // Surface credit usage as it happens.
  const wrapper = new ContextWrapper({
    onCredits: (e) =>
      console.log(
        `[credits] ${e.endpoint}: consumed=${e.consumed ?? '?'} remaining=${e.remaining ?? '?'}`,
      ),
  });
  const runTool = createToolExecutor(wrapper);

  console.log(`> web_search  query=${JSON.stringify(QUERY)}  numResults=10\n`);
  const result = await runTool('web_search', { query: QUERY, numResults: 10 });

  if (!result.ok) {
    console.error('Call failed:', JSON.stringify(result.error, null, 2));
    const message = result.error?.message ?? '';
    const looksLikeEgressBlock =
      result.error?.code === 'connection' || /allowlist|egress|not in allowlist/i.test(message);
    if (looksLikeEgressBlock) {
      console.error(
        '\nThe pipeline reached the network layer but api.context.dev is not reachable from here\n' +
          '(a network egress allowlist is blocking it, not a bug in this integration). Run this\n' +
          'where api.context.dev is allowed, or add the host to your egress settings, then re-run.\n' +
          'See https://docs.context.dev/optimization/troubleshooting.',
      );
    }
    process.exitCode = 1;
    return;
  }

  const data = result.data as {
    query: string;
    results: Array<{ title: string; url: string; relevance: string; description: string }>;
  };
  console.log(`\n✓ ${data.results.length} results for "${data.query}":\n`);
  for (const [i, r] of data.results.entries()) {
    console.log(`${String(i + 1).padStart(2)}. [${r.relevance}] ${r.title}`);
    console.log(`    ${r.url}`);
    if (r.description) console.log(`    ${r.description}`);
  }
  if (result.credits) {
    console.log(
      `\nCredits — consumed: ${result.credits.consumed ?? '?'}, remaining: ${
        result.credits.remaining ?? '?'
      }`,
    );
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exitCode = 1;
});
