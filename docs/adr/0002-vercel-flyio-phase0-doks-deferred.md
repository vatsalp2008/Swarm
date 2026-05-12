# ADR-0002 — Vercel + Fly.io for Phase 0–1; DOKS deferred to Phase 2

- **Status:** Accepted
- **Date:** 2026-04-25
- **Deciders:** Vatsal (founder)

## Context

The original brief proposed DigitalOcean Kubernetes (DOKS) for the orchestrator and worker fleet. DOKS is a defensible long-term choice but introduces ~1–2 weeks of yak-shaving on Day 1 (Helm charts, ingress controllers, cert-manager, secrets management, Argo CD, image registry).

SWARM has zero users, zero revenue, and one part-time founder. Phase 0 must run on free tiers and produce a shippable vertical slice in 5–6 weeks. Premature K8s burns the budget.

## Decision

- **Web (`apps/web`)** deploys to Vercel Hobby (free).
- **Orchestrator (`apps/orchestrator`)** deploys to Fly.io free tier (3 × shared-cpu-1x, 256MB).
- **Datastore + Auth + Storage + Vault** on Supabase Free.
- **Dockerize the orchestrator from day one** so the future migration to DOKS (or any container platform) is a config swap, not a rewrite.

## Consequences

- **Pros:** $0/mo infra. Both platforms have first-class deploy UX (no operator skills required). Vercel handles edge networking, Next.js streaming, and preview deploys for free.
- **Cons:** Fly.io free tier RAM (256MB) may be insufficient when we add LangGraph.js + Stagehand local Playwright in Weeks 3–4. We'll measure RSS during Phase 0 and either (a) trim, (b) move Stagehand to a separate Fly machine, or (c) bump to a paid tier when revenue justifies.
- **Cons:** Vercel cold starts on free tier. Acceptable for Phase 0 demo traffic.
- **Neutral:** When we move to DOKS, we'll need to re-create networking (egress for Browserbase, Postgres connection pooling).

## Revisit if

- Sustained orchestrator memory pressure exceeds Fly.io free tier (mitigation: paid Fly machine ~$10/mo before considering DOKS).
- Concurrent task volume hits ~50 sustained — at that point validate Fly.io scaling vs. evaluate DOKS.
- Vercel Hobby usage limits become binding (function invocations, bandwidth) — this likely happens during a launch event; switch to Vercel Pro before DOKS.
- A regulated workflow (FERPA, FCRA) requires VPC isolation that managed PaaS can't provide.

## Migration sketch (Phase 2 → DOKS)

1. Build orchestrator Docker image in CI (already required by this ADR).
2. Provision DOKS cluster via Terraform (`infra/terraform/` reserved).
3. Migrate orchestrator workload (Helm chart). Keep web on Vercel — no need to move it yet.
4. Validate Postgres connectivity from cluster (pgBouncer if needed).
