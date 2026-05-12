# `infra/seed/`

Seed data applied to the database after migrations. Run via:

```bash
pnpm --filter @swarm/db seed
```

## Files

| File | Committed? | Purpose |
|---|---|---|
| `site_policy.example.yaml` | yes | Template + public allow/deny list (Wellfound, Handshake, LinkedIn). Read by the seed script. |
| `site_policy.local.yaml` | **no** | Local-only deploy config. Founder's home-institution host enumeration lives here per ADR-0004. Gitignored. |

## How the seed script picks files

The seed reads `site_policy.local.yaml` if present, else falls back to `site_policy.example.yaml`. Both files share the same schema; the local file is expected to be a superset of the example with additional `deny:` entries.

## Adding hosts

1. Edit the appropriate file (example for public hosts; local for institution-specific).
2. Re-run the seed. The script upserts on `host` so changes are idempotent.
3. Audit event `site_policy.updated` is emitted for every row written.
