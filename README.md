# SWARM

Asynchronous parallel agents for delegated, authentication-aware tasks.

> **Status:** Phase 0 — foundation. Not for users yet. The code in this repo is a working monorepo skeleton; real Bees land in Phase 0 Weeks 3–4. See [docs/PLAN.md](docs/PLAN.md) for the binding plan.

## What's here

| Path | Purpose |
|---|---|
| [apps/web](apps/web/) | Next.js 15 App Router. Supabase Auth, route handlers serve as the API. |
| [apps/orchestrator](apps/orchestrator/) | LangGraph.js worker. Listens for tasks via Postgres LISTEN/NOTIFY; runs the Queen graph. |
| [packages/db](packages/db/) | Drizzle schema + migrations. Postgres single source of truth. |
| [packages/shared](packages/shared/) | Zod schemas, audit-event vocabulary, PII redaction, canonical JSON. |
| [packages/audit](packages/audit/) | Append-only audit log writer + SHA-256 hash-chain verifier (ADR-0005). |
| [packages/bee-sdk](packages/bee-sdk/) | Bee manifest contract, deterministic Critic, Compliance Agent (ADR-0004). |
| [packages/token-vault](packages/token-vault/) | OAuth token vault interface. In-memory impl for tests; Supabase Vault impl Phase 1 (ADR-0003). |
| [docs/adr](docs/adr/) | Architecture Decision Records 0001–0005. |
| [docs/PLAN.md](docs/PLAN.md) | The Phase 0 plan. Binding. |
| [infra/fly](infra/fly/) | Fly.io config for the orchestrator. |
| [.github/workflows](.github/workflows/) | CI: typecheck + test + build on every PR. |

## Prerequisites

- **Node 22 LTS** (use `nvm use` — `.nvmrc` pins it).
- **pnpm 9+** (`corepack enable && corepack prepare pnpm@9.15.0 --activate`).
- **Docker** for orchestrator container builds (optional in dev).

## Free-tier account checklist

Phase 0 runs on $0/mo. Sign up for these (use a dedicated email separate from any school-affiliated identity — see `docs/adr/0004-tos-posture-user-as-principal-deny-list.md`):

- [ ] **Supabase** — https://supabase.com — create a project; note `Project URL`, `anon key`, `service_role key`, and the `Database URL` (direct, port 5432).
- [ ] **Vercel** — https://vercel.com — connect the GitHub repo, deploy `apps/web` only.
- [ ] **Fly.io** — https://fly.io — install `flyctl`, then `fly launch --no-deploy --config infra/fly/fly.toml --name swarm-orchestrator`.
- [ ] **Google AI Studio** — https://aistudio.google.com/apikey — generate a Gemini API key. Free tier: Flash 1000 RPM.
- [ ] **LangSmith** — https://smith.langchain.com — Developer tier (5k traces/mo).
- [ ] **GitHub Actions** — already enabled by `.github/workflows/ci.yml`.

## Quickstart

```bash
git clone <this-repo>
cd Swarm
pnpm install

# 1. Set up env files — fill in values from the accounts above
cp apps/web/.env.example apps/web/.env.local
cp apps/orchestrator/.env.example apps/orchestrator/.env

# 2. Generate and apply DB migrations against your Supabase project
pnpm --filter @swarm/db generate
pnpm --filter @swarm/db migrate

# 3. Run the dev stack (web + orchestrator)
pnpm dev
```

Visit `http://localhost:3000`. Sign up, log in, hit `/dashboard`.

## Common commands

```bash
pnpm dev             # all apps, watch mode
pnpm build           # all apps + packages
pnpm test            # vitest across all packages
pnpm typecheck       # tsc --noEmit across all packages
pnpm lint            # eslint where configured
pnpm format          # prettier write

# DB
pnpm db:generate     # regenerate migrations from Drizzle schema
pnpm db:migrate      # apply migrations to DATABASE_URL
pnpm db:studio       # Drizzle Studio (browse the DB)

# Audit
pnpm verify:audit    # replay the SHA-256 chain end-to-end (CI runs this)
```

## How the bones fit together (Phase 0 flow)

```
        ┌─────────────┐                      ┌──────────────────────┐
  user  │  apps/web   │  POST /api/tasks     │  apps/orchestrator   │
   ──▶  │  Next.js    │  ──────────────▶     │  LangGraph.js        │
        │             │  pg_notify('swarm_   │                      │
        │             │   tasks', taskId)    │  Queen graph:        │
        └─────────────┘                      │   load_task          │
              │                              │   → mark_awaiting_   │
              ▼                              │     review (Phase 0  │
        ┌─────────────────────┐              │     stub; Bees in    │
        │  Supabase Postgres  │  ◀───────────│     Week 3)          │
        │  - tasks            │   reads/     │                      │
        │  - bee_runs         │   writes     │                      │
        │  - review_queue     │              └──────────────────────┘
        │  - audit_log        │
        │  - site_policy      │
        │  - vault_tokens     │
        └─────────────────────┘
```

## Roadmap pointer

Phase 0 ships the bones. Phase 1 (per `docs/PLAN.md`) introduces authenticated Bees — **and is gated on retained legal counsel reviewing ADR-0004 and the production ToS.** Don't ship Phase 1 without that.

## License

Not yet licensed (private). Add a license before any public release.