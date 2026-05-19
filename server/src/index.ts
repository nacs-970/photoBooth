import Fastify from 'fastify';
import { cameraRoutes } from './routes/camera.ts';

const app = Fastify({ logger: true });

await app.register(cameraRoutes);

try {
  await app.listen({ port: 3001, host: '0.0.0.0' });
  console.log('PhotoBooth server listening on http://0.0.0.0:3001');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
