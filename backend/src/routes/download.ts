import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';

const MB = 1024 * 1024;
const MAX_DOWNLOAD_MB = 100;
const CHUNK_SIZE = 64 * 1024;

// Bloque aleatorio reutilizable: datos incompresibles sin regenerarlos por request.
const RANDOM_CHUNK = randomBytes(CHUNK_SIZE);

/**
 * GET /api/download?sizeInMb=10 — transmite N MB de bytes aleatorios
 * en streaming. Content-Length permite al cliente calcular el progreso.
 */
export async function downloadRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { sizeInMb?: string } }>('/download', async (req, reply) => {
    const requested = Number(req.query.sizeInMb ?? 10);
    if (!Number.isFinite(requested) || requested <= 0 || requested > MAX_DOWNLOAD_MB) {
      return reply
        .code(400)
        .send({ error: `sizeInMb debe estar entre 0 y ${MAX_DOWNLOAD_MB}` });
    }

    const totalBytes = Math.floor(requested * MB);
    let sent = 0;

    const stream = new Readable({
      read() {
        if (sent >= totalBytes) {
          this.push(null);
          return;
        }
        const remaining = totalBytes - sent;
        const chunk = remaining >= CHUNK_SIZE ? RANDOM_CHUNK : RANDOM_CHUNK.subarray(0, remaining);
        sent += chunk.length;
        this.push(chunk);
      },
    });

    return reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Length', totalBytes)
      .header('Cache-Control', 'no-store, no-transform')
      .send(stream);
  });
}
