import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health.js';
import { downloadRoutes } from './routes/download.js';
import { uploadRoutes } from './routes/upload.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
/** Tamaño máximo aceptado en /upload (MB). */
export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 50);

const app = Fastify({
  logger: true,
  bodyLimit: MAX_UPLOAD_MB * 1024 * 1024,
});

await app.register(cors, { origin: true });

// Aceptar cuerpos binarios crudos sin parsearlos (para el test de subida).
app.addContentTypeParser(
  'application/octet-stream',
  (_req, payload, done) => done(null, payload),
);

await app.register(healthRoutes, { prefix: '/api' });
await app.register(downloadRoutes, { prefix: '/api' });
await app.register(uploadRoutes, { prefix: '/api' });

try {
  await app.listen({ port: PORT, host: HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
