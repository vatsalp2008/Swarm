import { logger } from './logger.js';

/**
 * Stagehand wrapper. Phase 0 backend is local Playwright; Phase 1 flips to
 * Browserbase via env var (`STAGEHAND_ENV=BROWSERBASE` + `BROWSERBASE_API_KEY`).
 *
 * We deliberately do NOT import @browserbasehq/stagehand at module top-level
 * here — its Playwright dependency tries to launch a real browser on import in
 * some versions. Instead, callers grab a session via `withBrowserSession`,
 * which lazy-imports.
 */

export interface BrowserSession {
  /** Underlying Playwright Page-like object. */
  page: import('@browserbasehq/stagehand').Page;
  /** Stagehand instance for AI-augmented actions (act, observe, extract). */
  stagehand: import('@browserbasehq/stagehand').Stagehand;
}

export interface BrowserSessionOptions {
  /** Optional explicit env override. Defaults to STAGEHAND_ENV. */
  env?: 'LOCAL' | 'BROWSERBASE';
  /** Trace ID — included in Stagehand logs and session metadata when supported. */
  traceId?: string;
  /** Per-session timeout in ms. Default 60_000. */
  timeoutMs?: number;
}

/**
 * Run `fn` with a fresh browser session. Session is closed regardless of
 * outcome. Returns the function's result.
 *
 * Resource discipline: never let a session escape this closure. Each Bee run
 * gets its own session; sessions are destroyed on completion (ADR-0004 isolation).
 */
export async function withBrowserSession<T>(
  fn: (session: BrowserSession) => Promise<T>,
  options: BrowserSessionOptions = {},
): Promise<T> {
  const { Stagehand } = await import('@browserbasehq/stagehand');
  const env = options.env ?? (process.env.STAGEHAND_ENV as 'LOCAL' | 'BROWSERBASE') ?? 'LOCAL';

  const stagehand = new Stagehand({
    env,
    // Stagehand's internal LLM defaults to OpenAI; pin to a Gemini provider
    // when the upstream SDK exposes that switch. For Phase 0 with a stable set
    // of target sites we lean on hand-coded selectors and rarely use act().
    verbose: 0,
  });
  await stagehand.init();

  const timeout = setTimeout(() => {
    logger.warn({ traceId: options.traceId }, 'browser session timeout — forcing close');
    stagehand.close().catch(() => undefined);
  }, options.timeoutMs ?? 60_000);

  try {
    const session: BrowserSession = { page: stagehand.page, stagehand };
    return await fn(session);
  } finally {
    clearTimeout(timeout);
    await stagehand.close().catch((err) => logger.warn({ err }, 'stagehand close failed'));
  }
}
