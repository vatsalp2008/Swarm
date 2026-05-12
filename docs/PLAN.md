# SWARM — Phase 0 Plan

> Status: **finalized, in execution.**

## Context

Greenfield project. A solo founder is building SWARM, a multi-agent platform for asynchronous, authentication-aware delegated tasks. Initial wedge: student busywork (internships, housing, scholarships, textbooks). Long-term: personal-agent OS.

**Hard constraints from founder:**
- **Solo founder, part-time** (school is competing demand)
- **Zero budget, free tiers only**
- ToS posture: **user-as-principal + deny-list**
- v1 sizing: 1000 registered users, ~50 concurrent tasks at peak
- **Stealth from the founder's home institution** — operating in stealth pre-launch
- No hard timeline — ship when quality and counsel allow

**Stealth-mode operational rules (binding for all phases):**
- No automation against systems operated by the founder's home institution (specific hosts maintained in a private deploy config, not committed to this repo)
- No use of the founder's school-affiliated email for SWARM service accounts (Vercel, Supabase, Fly.io, GitHub org, Gemini, LangSmith, domain registrar)
- No GitHub Education / Student Developer Pack benefits tied to the SWARM org account (school-affiliated identity is a discovery surface). Personal benefits on a personal repo are fine.
- Founder's school-affiliated identity stays separated from the company entity. Revisit when SWARM is incorporated and counsel has reviewed.

These constraints flip the brief's defaults. Phase 0 must run on $0/mo, ship in ~5–6 weeks of part-time work, and avoid every vendor that doesn't have a usable free tier.

The change being made: scaffold a monorepo with one end-to-end vertical slice (auth → Queen → Research Bee → Review Queue → audit log) that exercises every load-bearing seam **without** touching authenticated third-party services, paid infra, or irreversible actions.

## Pushback on the brief that informed this plan

1. Two runtimes (Py + TS) is a tax solo can't afford → ADR-001: TS everywhere, LangGraph.js
2. DOKS in Phase 0 is yak-shaving → ADR-002: Vercel + Fly.io free, DOKS at Phase 2 real load
3. Auth0 for AI Agents is paid; Solana SAS is theatre → ADR-003: Supabase Auth + Supabase Vault token store; ADR-005: Postgres hash-chain audit log only
4. "Gemma 4 via Gemini API" is a category error — Gemini = proprietary, Gemma = self-hosted. Phase 0 uses Gemini Flash via API only
5. Critic must be deterministic-first (regex/schema), LLM as second pass
6. CIBA on every irreversible action will destroy UX — risk-tiered policy in Phase 1
7. Handshake as first Bee = legal land mine → ADR-004 puts Handshake + LinkedIn on deny-list
8. 99.5% completion vs. zero-wrong-submission tension — restate target as "zero wrong submissions; completion is emergent"
9. Memory layer + pgvector + plugin architecture deferred to Phase 2; build the third Bee before extracting the abstraction
10. Voice (ElevenLabs), payments (Stripe), DO Spaces all deferred

## Decisions on the six open architectural questions

| # | Question | Recommendation | Trigger to revisit |
|---|---|---|---|
| 1 | Orchestrator language | **TypeScript** (LangGraph.js) | Python-first ML hire |
| 2 | Browser automation | **Stagehand on local Playwright** in Phase 0; flip to Browserbase in Phase 1 (free hobby tier first) | Browserbase spend ≥ $10k/mo → revisit self-host |
| 3 | Agent state | **LangGraph.js + Postgres checkpointer** in-process | Multi-hour cross-agent workflows → Inngest, not Temporal |
| 4 | LLM cost | **Gemini Flash for Bees, Gemini Pro for Queen**, both via free API tier in Phase 0 | Gemini spend ≥ $30k/mo and steady → Gemma self-host |
| 5 | ToS posture | **User-as-principal + per-site allow/deny DB**; Handshake + LinkedIn on deny-list | Counsel review before Phase 1 ships (non-negotiable) |
| 6 | Liability | ToS w/ user indemnification, arbitration, damages cap; airtight per-action audit; **E&O at first paying customer** | First paying customer = E&O policy bound |

## Stack (Phase 0, $0/mo)

| Layer | Service | Tier | Notes |
|---|---|---|---|
| Web hosting | Vercel | Hobby (free) | Next.js 15 App Router |
| Orchestrator + API | Fly.io | Free (3 × shared-cpu-1x, 256MB) | Long-lived LangGraph.js worker; need to validate 256MB is enough |
| DB + Auth + Storage + Vault | Supabase | Free | 500MB DB, 1GB storage, pgsodium for column encryption |
| Browser automation | Stagehand + local Playwright | OSS | Browserbase deferred to Phase 1 |
| LLM | Gemini API | Free tier | Flash 1000 RPM, sufficient for dev |
| Agent tracing | LangSmith | Developer free | 5k traces/mo |
| CI | GitHub Actions | Free | 2000 mins/mo |
| Source control | GitHub | Free | Personal account or new SWARM org under a non-school-affiliated email; **do not** apply Student Developer Pack to SWARM org (stealth) |

**Deferred until revenue or alpha launch:** Browserbase paid tier, Auth0 user auth, Auth0 for AI Agents, ElevenLabs, OpenTelemetry → Grafana, DO Spaces, Stripe, Datadog.

## Monorepo layout

```
swarm/
├── apps/
│   ├── web/              # Next.js 15 App Router; route handlers serve as the API; shadcn/ui + TanStack Query
│   └── orchestrator/     # LangGraph.js worker on Fly.io; long-running process; receives jobs via Postgres LISTEN/NOTIFY or Redis
├── packages/
│   ├── db/               # Drizzle schema + migrations; query helpers
│   ├── shared/           # Zod schemas, shared types, constants
│   ├── bee-sdk/          # Bee contract: manifest, tool registration, Critic deterministic-check hooks
│   ├── audit/            # Append-only writer + SHA-256 hash-chain helpers
│   └── token-vault/      # Supabase Vault wrapper; envelope encryption; defined interface so Auth0 swap is a constructor change
├── infra/
│   ├── fly/              # fly.toml for orchestrator
│   └── terraform/        # Reserved for Phase 2 DOKS migration
├── docs/
│   └── adr/              # ADR-001 through ADR-005
└── tests/
    └── e2e/              # The single integration test that proves the bones
```

**Note:** No separate `apps/api`. Next.js route handlers in `apps/web/app/api/` are the API. Solo + free-tier doesn't justify the second deploy target.

## DB schema (initial Drizzle)

- `users` — id, email, created_at (managed by Supabase Auth, mirrored)
- `tasks` — id, user_id, prompt, status, created_at, trace_id (LangSmith)
- `bee_runs` — id, task_id, bee_type, status, started_at, ended_at, output_json, critic_passed, compliance_passed
- `review_queue_items` — id, bee_run_id, proposal_json, status (pending/approved/denied), decided_at, decided_by
- `site_policy` — id, host, status (allow/deny/negotiated), reason, updated_at
- `audit_log` — id, ts, user_id, trace_id, event_type, payload_json, prev_hash, this_hash (SHA-256 chain)
- `vault_tokens` — id, user_id, provider, encrypted_token (pgsodium), scopes, expires_at  *(stub for Phase 0; populated in Phase 1)*

## Phase 0 — 5–6 weeks part-time

### Weeks 1–2: Foundation
- pnpm + Turborepo monorepo
- `apps/web` and `apps/orchestrator` scaffolded
- Supabase project: Postgres + Auth + Vault enabled
- Drizzle schema migrated
- Sign-up / sign-in via Supabase Auth on web
- Fly.io account, orchestrator deploys via `fly deploy`
- LangSmith project created, Gemini SDK + LangGraph.js scaffolded
- CI: typecheck + lint + unit tests on PRs

### Weeks 3–4: Research Bee end-to-end (no auth, no submission)
- Stagehand integrated in orchestrator (local Playwright backend)
- Queen graph: classify → dispatch Research Bee → collect result → write to `bee_runs`
- Research Bee: scoped to public, allow-listed sites only (Wellfound, YC WaaS public pages, Indeed Job Search public API)
- Critic Agent: zod schema validation first; Gemini Flash fact-check second
- Compliance Agent: per-host lookup against `site_policy`; default-deny on unknown hosts
- Job dispatch web → orchestrator via Postgres LISTEN/NOTIFY (no Redis yet — Supabase doesn't offer it on free tier; LISTEN/NOTIFY is sufficient at this volume)

### Weeks 5–6: Review Queue + audit + ADRs
- Review Queue UI: list pending proposals, approve / deny per item, see source URLs
- Approve/deny → mutates `review_queue_items` + writes to `audit_log` with hash chain
- PII redaction middleware in `packages/shared` (regex first pass: SSN, DOB, phone, account numbers) running on all payloads before LLM calls
- Dockerfile for orchestrator (so Phase 2 DOKS migration is a config swap)
- ADRs 001–005 authored
- End-to-end integration test passing in CI

## First five ADRs

1. **ADR-001** — TypeScript everywhere; LangGraph.js for orchestration. Single runtime, end-to-end type safety, parity reached early 2026. Revisit if Python-first hire.
2. **ADR-002** — Vercel (web) + Fly.io (orchestrator) for Phase 0–1; DOKS deferred to Phase 2. Avoid yak-shaving for solo founder; Dockerize from day one so migration is a config swap.
3. **ADR-003** — Supabase Auth for user login; **Supabase Vault + pgsodium** for third-party token vault in Phase 0–1; migrate to Auth0 for AI Agents (or HashiCorp Vault) when revenue exists. `packages/token-vault` defines the interface so the swap is a constructor change. Decision driven by $0 budget; Auth0 for AI Agents is the production target.
4. **ADR-004** — ToS posture: user-as-principal + per-site allow/deny DB. Default-deny on unknown hosts. **Permanent Phase 0–1 deny-list:** Handshake, LinkedIn, and all systems operated by the founder's home institution (specific hosts in a private deploy config, not committed to this repo). The founder's school-affiliated email is never used for SWARM service accounts. Phase 1 cannot ship without legal counsel review. Phase 0 is research-only on indifferent / public sites, so ToS exposure is bounded.
5. **ADR-005** — Audit log = Postgres append-only table with per-row SHA-256 hash chain. Solana SAS anchoring dropped. Hash chain in Postgres satisfies SOC 2 Type II claims; public-chain anchoring has zero value before deposition.

## First end-to-end integration test (the bones)

**Path:** Authenticated user (Supabase Auth) → submits prompt "find 5 software engineering intern postings at SF-based YC companies with on-site office" → Next.js route handler enqueues task → orchestrator picks up via LISTEN/NOTIFY → Queen routes to Research Bee → Bee runs Stagehand on Playwright against YC WaaS / Wellfound → returns 5 candidates with source URLs → Critic runs zod schema validation + Gemini Flash fact-check ("are these YC, are they SF") → Compliance Agent confirms target hosts on allow-list → result written to `review_queue_items` → user opens Review Queue → approves → audit log records the chain (user_id, trace_id, bee_id, MFA: N/A, ToS: pass, outcome: approved).

**Seams exercised:** Supabase Auth, Next.js route handler, orchestrator dispatch, Bee spawn, Stagehand, Gemini, LangSmith trace, Critic deterministic + LLM passes, Compliance lookup, Review UI render, approve action, audit hash-chain write + verifiable replay.

**Seams deliberately not exercised in Phase 0:** CIBA step-up MFA, OAuth Token Vault, irreversible third-party submissions, voice review, memory/pgvector, plugin loading, Stripe, multi-tenant workspaces, Browserbase.

## Verification

- `pnpm test` — Vitest across all packages, run on every PR
- `pnpm test:e2e` — integration test above against Fly.io preview deploy with seeded test user
- LangSmith trace ID per task = single observability anchor
- Audit log integrity verifiable by replaying SHA-256 chain from row 0 → current; dedicated `pnpm verify:audit` script

## Items deferred for explicit founder decision after Phase 0 ships

- **Monetization** — defer until alpha exit. Free during Phase 0–1 alpha; subscription vs. per-task decision deferred to Phase 2 once usage patterns are visible.
- **Legal counsel** — must be retained before Phase 1 ships. Budget $5–10k for initial CFAA + tech-transactions opinion. Cooley, Latham, or boutique (Rimon).
- **Company entity** — recommend Delaware C-corp before retaining counsel and before Phase 1 launch, but defer the formation decision.
- **E&O insurance** — bound at first paying customer (Phase 2). Vouch or Embroker; $3–5M policy.
- **Auth0 for AI Agents migration** — `packages/token-vault` interface is the seam. Migrate when revenue covers cost or when first regulated workflow ships.
