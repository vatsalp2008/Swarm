import { z } from 'zod';
import { JobPostingResult, ResearchBeeOutput } from '@swarm/shared';
import type { RegisteredBee } from '@swarm/bee-sdk';
import { withBrowserSession } from '../browser.js';
import { logger } from '../logger.js';

/**
 * Research Bee — Phase 0 first Bee. Public sites only, no auth, no submission.
 *
 * Strategy: lightweight Playwright navigation against Wellfound (and YC WaaS
 * if extended later). We deliberately use hand-coded DOM selectors here rather
 * than Stagehand's LLM-augmented `page.act()` — the targets are stable enough
 * that the LLM-resolved layer would just add cost and flakiness. Stagehand's
 * `extract()` is the right tool when we add the third/fourth target site.
 */

const ResearchBeeInput = z.object({
  query: z.string().min(1).max(500),
  /** Max results to return; capped at 20. */
  limit: z.number().int().positive().max(20).default(10),
});
type ResearchBeeInputT = z.infer<typeof ResearchBeeInput>;
type ResearchBeeOutputT = z.infer<typeof ResearchBeeOutput>;

const TARGET_HOSTS = ['wellfound.com', 'www.wellfound.com'] as const;

export const researchBee: RegisteredBee<ResearchBeeInputT, ResearchBeeOutputT> = {
  manifest: {
    type: 'research',
    displayName: 'Research Bee',
    targetHosts: TARGET_HOSTS,
    requiredScopes: [],
    inputSchema: ResearchBeeInput,
    outputSchema: ResearchBeeOutput,
    groundTruthChecks: [
      // Every result URL must be HTTPS — defends against accidental http:// scrape leakage.
      (out) => (out.results.every((r) => r.url.startsWith('https://')) ? null : 'all result URLs must be https'),
      // Every result URL host must be in the manifest's allow-listed targets.
      (out) => {
        const allowed = new Set<string>(TARGET_HOSTS);
        const bad = out.results.find((r) => {
          try {
            return !allowed.has(new URL(r.url).hostname);
          } catch {
            return true;
          }
        });
        return bad ? `result url host not in target list: ${bad.url}` : null;
      },
      // At least one result — otherwise the Bee is reporting empty success, which is suspicious.
      (out) => (out.results.length > 0 ? null : 'no results returned'),
      // Reasonable result count cap — guards against runaway scrape.
      (out) => (out.results.length <= 50 ? null : 'too many results (>50)'),
    ],
    costClass: 'low',
  },

  async run(input, ctx): Promise<ResearchBeeOutputT> {
    logger.info({ beeRunId: ctx.beeRunId, query: input.query }, 'research bee run start');

    return withBrowserSession(
      async ({ page }) => {
        const searchUrl = `https://wellfound.com/jobs?keywords=${encodeURIComponent(input.query)}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

        // Hand-coded extraction. The selectors below will need updating when
        // Wellfound redesigns; failure surfaces as a Critic ground-truth fail
        // ("no results returned") rather than a silent break.
        const cards = await page.locator('[data-test="JobSearchResults"] [data-test="JobCard"]').all();

        const results: z.infer<typeof JobPostingResult>[] = [];
        for (const card of cards.slice(0, input.limit)) {
          if (ctx.signal.aborted) break;
          try {
            const title = (await card.locator('[data-test="JobTitle"]').first().textContent())?.trim() ?? '';
            const company =
              (await card.locator('[data-test="StartupName"]').first().textContent())?.trim() ?? '';
            const location =
              (await card.locator('[data-test="Location"]').first().textContent())?.trim() ?? null;
            const href = await card.locator('a[href*="/jobs/"]').first().getAttribute('href');
            if (!href || !title || !company) continue;
            const url = href.startsWith('http') ? href : `https://wellfound.com${href}`;
            results.push({
              title,
              company,
              location,
              url,
              source: 'wellfound.com',
              postedAt: null,
            });
          } catch (err) {
            logger.debug({ err }, 'research bee: skipping malformed card');
          }
        }

        logger.info({ beeRunId: ctx.beeRunId, count: results.length }, 'research bee run end');
        return {
          query: input.query,
          results,
          notes: results.length === 0 ? 'No results returned by Wellfound for this query.' : undefined,
        };
      },
      { traceId: ctx.traceId, timeoutMs: 60_000 },
    );
  },
};
