# ADR-0004 — ToS posture: user-as-principal + per-site allow/deny database

- **Status:** Accepted (provisional — subject to retained legal counsel review before Phase 1 ships)
- **Date:** 2026-04-25
- **Deciders:** Vatsal (founder)

## Context

SWARM automates actions on third-party services on behalf of users. Most target sites have ToS that either ambiguously or explicitly prohibit automation. Three postures were considered:

1. **Ask forgiveness** — run automation on hostile sites (Handshake, LinkedIn) and handle takedowns reactively. Fast wedge; cease-and-desist within ~6 months is realistic. Viable only with significant funding and willingness to pivot under pressure.
2. **Negotiate first** — partner with target sites for sanctioned access. Most legally defensible; 12–18 month enterprise sales cycles will starve a pre-revenue solo founder.
3. **User-as-principal + per-site allow/deny DB** — the user, not SWARM, is the actor; SWARM is a tool. Defensible under hiQ Labs v. LinkedIn for public scraping; weaker for authenticated automation; better than (1) and faster than (2).

The founder is solo, part-time, on $0 budget, with no retained counsel, and is operating in stealth from a home institution whose career services depend on Handshake — making Handshake a worst-case enforcement target.

## Decision

1. **Posture: user-as-principal.** SWARM is presented as a tool the user runs against their own accounts. ToS will codify this with user indemnification and a clear "you are the actor" clause.
2. **Per-site allow/deny database** in the `site_policy` table. Default-deny on unknown hosts. The Compliance Agent enforces per-host policy on every Bee run before any browser action executes.
3. **Permanent Phase 0–1 deny-list** (additions require explicit founder + counsel approval):
   - **Handshake** (any `*.joinhandshake.com`, `*.handshake.com`)
   - **LinkedIn** (any `*.linkedin.com`)
   - **All systems operated by the founder's home institution** (specific hosts — domain, SSO endpoints, LMS, SIS, career-services portal, webmail, ID systems — are maintained in a private deploy config not committed to this repository and seeded into `site_policy` at deploy time)
4. **Phase 0 allow-list (research-only, no auth, no submission):**
   - `*.wellfound.com`
   - `*.workatastartup.com` (YC WaaS public pages only)
   - `indeed.com` Job Search public API only — not browser scraping
5. **Founder identity separation:** SWARM service accounts (Vercel, Supabase, Fly.io, GitHub org, Gemini, LangSmith, registrar) must use an email separate from any school-affiliated identity. The founder's school-affiliated identity is never used as a SWARM service principal.
6. **Phase 1 ship gate:** No Phase 1 release that introduces authenticated third-party Bees may ship without (a) retained CFAA + tech-transactions counsel review and (b) updated ToS approved by counsel. Budget $5–10k for the initial opinion.

## Consequences

- **Pros:** Maintains a defensible legal posture. Avoids the worst enforcement target (Handshake → home-institution career services → founder identity exposure). Allows Phase 0 to ship with bounded ToS risk.
- **Cons:** Excluding LinkedIn and Handshake from launch means the Application Bee has a weaker initial value proposition. Mitigation: position around Wellfound + YC WaaS ("startups want you, big-board recruiting wants resumes") — this is also a sharper marketing wedge.
- **Risk:** "User-as-principal" is fragile if a court finds SWARM is the actor in fact. Mitigations: (a) airtight per-action audit log showing user approval (ADR-0005), (b) UI emphasizes user as the runner of every action, (c) ToS clauses, (d) E&O insurance from Phase 2.

## Revisit if

- Counsel issues an opinion contrary to user-as-principal framing.
- A target site explicitly opts in to SWARM automation (in writing, via Compliance Agent allow-list update).
- A C&D arrives — re-evaluate the deny-list and posture immediately.
- Founder's school enrollment status changes (graduation, transfer) — reassess stealth-mode rules.

## Operational rules (binding)

- The Compliance Agent must default-deny unknown hosts. No code path may bypass it.
- All Bee browser sessions log target hosts to the audit ledger.
- Any addition to the allow-list requires (a) a row in `site_policy`, (b) a corresponding ADR amendment or new ADR, (c) for Phase 1+, counsel signoff documented in the ADR.
