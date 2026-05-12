import { customType } from 'drizzle-orm/pg-core';

/**
 * Postgres `bytea` column. Drizzle does not ship a built-in bytea type; this
 * custom mapping treats it as `Buffer` in JS.
 */
export const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return 'bytea';
  },
});