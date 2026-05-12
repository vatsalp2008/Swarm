# Architecture Decision Records

ADRs document architectural choices, the context that drove them, and the conditions under which they should be revisited. Format is a lightweight MADR variant.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-typescript-everywhere-langgraph-js.md) | TypeScript everywhere; LangGraph.js for orchestration | Accepted |
| [0002](0002-vercel-flyio-phase0-doks-deferred.md) | Vercel + Fly.io for Phase 0–1; DOKS deferred to Phase 2 | Accepted |
| [0003](0003-supabase-auth-and-vault-token-store.md) | Supabase Auth for users; Supabase Vault for third-party tokens | Accepted |
| [0004](0004-tos-posture-user-as-principal-deny-list.md) | ToS posture: user-as-principal + per-site allow/deny database | Accepted (provisional) |
| [0005](0005-audit-log-postgres-hash-chain.md) | Audit log: Postgres append-only with SHA-256 hash chain | Accepted |

## Authoring guidelines

- One file per decision. Number sequentially.
- Sections: Context, Decision, Consequences (pros/cons), Revisit if.
- Keep under one page. ADRs are for posterity, not Phase 0 polish.
- Status is `Proposed`, `Accepted`, `Superseded by ADR-NNNN`, or `Deprecated`.
- Never delete an ADR. Mark superseded and add a successor.
