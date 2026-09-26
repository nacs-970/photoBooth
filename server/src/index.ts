import Fastify from 'fastify';
import { cameraRoutes } from './routes/camera.js';

const app = Fastify({ logger: true });

await app.register(cameraRoutes);

// Localhost only: the stream and capture routes have no auth. Set HOST to override.
const HOST = process.env.HOST || '127.0.0.1';

try {
  await app.listen({ port: 3001, host: HOST });
  console.log(`PhotoBooth server listening on http://${HOST}:3001`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
