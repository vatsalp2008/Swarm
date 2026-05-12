import { getDb, closeDb } from '@swarm/db';
import { runQueenForTask } from './queen.js';
import { startTaskListener } from './listener.js';
import { startHealthServer } from './health.js';
import { logger } from './logger.js';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error('DATABASE_URL is required');
    process.exit(1);
  }
  const channel = process.env.LISTEN_CHANNEL ?? 'swarm_tasks';
  const port = Number(process.env.PORT ?? 8080);

  const db = getDb();
  const httpServer = startHealthServer(port);
  const listener = await startTaskListener(databaseUrl, channel, async (taskId) => {
    logger.info({ taskId }, 'received task notification');
    await runQueenForTask(db, taskId);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutting down');
    httpServer.close();
    await listener.stop();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'fatal');
  process.exit(1);
});