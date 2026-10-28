import type { Readable } from 'node:stream';
import type { FastifyInstance } from 'fastify';

/**
 * POST /api/upload (Content-Type: application/octet-stream)
 * Consume el cuerpo sin almacenarlo y devuelve bytes recibidos y
 * duración medida en el servidor, para contrastar con la medición del cliente.
 */
export async function uploadRoutes(app: FastifyInstance) {
  app.post('/upload', async (req) => {
    const start = process.hrtime.bigint();
    let receivedBytes = 0;

    for await (const chunk of req.body as Readable) {
      receivedBytes += (chunk as Buffer).length;
    }

    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const mbps = durationMs > 0 ? (receivedBytes * 8) / (durationMs / 1000) / 1e6 : 0;

    return {
      receivedBytes,
      serverDurationMs: Math.round(durationMs),
      serverMbps: Number(mbps.toFixed(2)),
    };
  });
}
