# ADR-0003 — Supabase Auth for users; Supabase Vault for third-party tokens; Auth0 for AI Agents deferred

- **Status:** Accepted
- **Date:** 2026-04-25
- **Deciders:** Vatsal (founder)

## Context

The original brief proposed Auth0 for user authentication AND Auth0 for AI Agents (Token Vault + OpenFGA + CIBA) for managing third-party OAuth tokens and step-up MFA. This is the production-correct design but it has two problems for Phase 0:

1. Auth0 has a generous free tier for user auth (25k MAU), but Auth0 for AI Agents is a paid product with no usable free tier as of April 2026.
2. Buying both Auth0 AND Supabase doubles the auth surface for zero added value at our scale.

We still need a third-party token vault — third-party OAuth tokens are the highest-risk data SWARM will hold. Rolling our own vault from scratch is malpractice. Supabase Vault (built on `pgsodium`) provides column-level authenticated encryption with a key managed by Supabase, hardware-backed in the underlying GCP/AWS KMS. That's strong enough for Phase 0–1.

## Decision

1. **User authentication:** Supabase Auth (free, included with the Supabase project we already need for Postgres).
2. **Third-party token vault:** Supabase Vault + `pgsodium` for column-level encryption of OAuth tokens. Keys are managed by Supabase; we never see plaintext keys. Implementation lives in `packages/token-vault` behind an interface so the implementation can be swapped without touching call sites.
3. **Step-up MFA (CIBA equivalent):** deferred to Phase 1. Phase 0 has no irreversible actions, so no MFA gating is required. When we need it in Phase 1, evaluate (a) Twilio Verify free tier, (b) WebAuthn-based push approval rolled into Supabase Auth, (c) Auth0 for AI Agents CIBA.
4. **Production target:** when revenue exists or a regulated workflow ships, migrate `packages/token-vault` to Auth0 for AI Agents (or HashiCorp Vault). The interface seam in `packages/token-vault` makes this a constructor change, not a rewrite.

## Consequences

- **Pros:** $0/mo. Supabase Vault is a defensible answer to "where are user OAuth tokens stored?" — encrypted at rest with KMS-backed keys, no plaintext in app memory.
- **Cons:** Supabase Vault doesn't provide CIBA-style asynchronous step-up MFA out of the box. We'll bridge with Twilio Verify or WebAuthn in Phase 1. Pure FGA (per-Bee scope enforcement) requires us to enforce in app code, not at the vault layer — a real downgrade vs. OpenFGA.
- **Cons:** Supabase Auth's session model (JWT in cookies) is tied to Supabase's infrastructure; migrating users to Auth0 later requires a session migration path.
- **Risk:** If Supabase ever has a key-management incident, we are exposed. Mitigation: monthly token rotation in Phase 1; minimal scope per token.

## Revisit if

- We onboard a regulated workflow (FERPA, FCRA, payments touching credit data).
- A paying enterprise customer asks for SOC 2 Type II with explicit FGA evidence.
- Supabase changes Vault pricing or removes the free-tier capability.
- We hit the Phase 1 milestone where step-up MFA becomes load-bearing — at that point evaluate Auth0 for AI Agents vs. roll-your-own.

## Implementation note

`packages/token-vault` interface (illustrative):

```ts
interface TokenVault {
  put(userId: string, provider: string, token: SecretToken): Promise<TokenHandle>;
  get(handle: TokenHandle, requestingBeeId: string): Promise<SecretToken>;
  revoke(handle: TokenHandle): Promise<void>;
}
```

Phase 0–1: `SupabaseVaultImpl` — encrypts via pgsodium, enforces per-Bee scope in app code.
Phase 2+: `Auth0AIVaultImpl` — same interface, wraps Auth0 for AI Agents.
