import type { FastifyInstance } from 'fastify';
import { detectCamera } from '../camera/detect.ts';

export async function cameraRoutes(app: FastifyInstance) {
  app.get('/api/camera/info', async () => {
    return detectCamera();
  });
}
