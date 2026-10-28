import type { FastifyInstance } from 'fastify';

/**
 * GET /api/ping — respuesta mínima para medir RTT a nivel HTTP
 * y verificar disponibilidad del servidor.
 */
export async function healthRoutes(app: FastifyInstance) {
  app.get('/ping', async () => ({ ok: true, serverTime: Date.now() }));
}
