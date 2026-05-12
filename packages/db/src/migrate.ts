import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required.');
  }

  // Migrations require prepared statements; force direct (5432) connection.
  const conn = postgres(url, { prepare: true, max: 1 });
  const db = drizzle(conn);

  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations complete.');

  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});