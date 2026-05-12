import postgres from 'postgres';
import { logger } from './logger.js';

/**
 * Postgres LISTEN/NOTIFY watcher. Subscribes to the configured channel and
 * invokes `onTask(taskId)` for each notification payload.
 *
 * Uses a dedicated, non-pooled connection — Supabase Supavisor (port 6543)
 * does not forward LISTEN/NOTIFY, so DATABASE_URL must point to the direct
 * connection (port 5432).
 */
export interface ListenerHandle {
  stop(): Promise<void>;
}

export async function startTaskListener(
  databaseUrl: string,
  channel: string,
  onTask: (taskId: string) => Promise<void>,
): Promise<ListenerHandle> {
  const sql = postgres(databaseUrl, { max: 1, idle_timeout: 0, connection: { application_name: 'swarm-orchestrator-listener' } });

  const sub = await sql.listen(
    channel,
    (payload) => {
      const taskId = payload?.trim();
      if (!taskId) {
        logger.warn({ payload }, 'received empty notification payload');
        return;
      }
      onTask(taskId).catch((err) => logger.error({ err, taskId }, 'onTask threw'));
    },
    () => logger.info({ channel }, 'listening for task notifications'),
  );

  return {
    async stop() {
      await sub.unlisten();
      await sql.end({ timeout: 5 });
    },
  };
}