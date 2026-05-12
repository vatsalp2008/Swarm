import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { load } from 'js-yaml';
import { z } from 'zod';
import { getDb, closeDb } from './client.js';
import { schema } from './index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SEED_DIR = resolve(__dirname, '../../../infra/seed');

const SitePolicyEntry = z.object({
  host: z.string().min(1),
  reason: z.string().optional(),
});

const SitePolicyFile = z.object({
  allow: z.array(SitePolicyEntry).default([]),
  deny: z.array(SitePolicyEntry).default([]),
  negotiated: z.array(SitePolicyEntry).default([]),
});

function loadSitePolicy() {
  const local = resolve(SEED_DIR, 'site_policy.local.yaml');
  const example = resolve(SEED_DIR, 'site_policy.example.yaml');
  const path = existsSync(local) ? local : example;
  if (!existsSync(path)) {
    throw new Error(`No site_policy seed file found at ${path}`);
  }
  console.log(`reading site_policy from ${path}`);
  const raw = readFileSync(path, 'utf8');
  const parsed = SitePolicyFile.parse(load(raw));
  return { path, ...parsed };
}

async function seedSitePolicy() {
  const { allow, deny, negotiated } = loadSitePolicy();
  const db = getDb();

  const rows = [
    ...allow.map((e) => ({ host: e.host, status: 'allow' as const, reason: e.reason ?? null })),
    ...deny.map((e) => ({ host: e.host, status: 'deny' as const, reason: e.reason ?? null })),
    ...negotiated.map((e) => ({
      host: e.host,
      status: 'negotiated' as const,
      reason: e.reason ?? null,
    })),
  ];

  if (rows.length === 0) {
    console.log('no site_policy rows to seed');
    return;
  }

  // Upsert on host (uniqueIndex from schema/tables.ts). Drizzle's onConflictDoUpdate.
  for (const row of rows) {
    await db
      .insert(schema.sitePolicy)
      .values(row)
      .onConflictDoUpdate({
        target: schema.sitePolicy.host,
        set: {
          status: row.status,
          reason: row.reason,
          updatedAt: sql`now()`,
        },
      });
  }

  console.log(`seeded ${rows.length} site_policy rows (${allow.length} allow / ${deny.length} deny / ${negotiated.length} negotiated)`);
}

async function main() {
  try {
    await seedSitePolicy();
  } finally {
    await closeDb();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
