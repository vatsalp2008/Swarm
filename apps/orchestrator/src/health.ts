import { createServer, type Server } from 'node:http';
import { logger } from './logger.js';

/**
 * Tiny HTTP server for liveness/readiness probes. Fly.io expects a TCP listener
 * on the configured port; we serve `/health` for completeness.
 */
export function startHealthServer(port: number): Server {
  const server = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: 'swarm-orchestrator', time: new Date().toISOString() }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  server.listen(port, () => logger.info({ port }, 'health server listening'));
  return server;
}