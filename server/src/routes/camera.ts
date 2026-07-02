import type { FastifyInstance } from 'fastify';
import { detectCamera } from '../camera/detect.js';
import { cameraService } from '../camera/CameraService.js';

export async function cameraRoutes(app: FastifyInstance) {
  app.get('/api/camera/info', async () => {
    return detectCamera();
  });

  app.get('/api/camera/stream', async (request, reply) => {
    if (cameraService.isCapturing) {
      reply.status(503).send('Capture in progress — retry in 2s');
      return;
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'multipart/x-mixed-replace; boundary=--frame',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Connection': 'close'
    });

    const onFrame = (frameBuf: Buffer) => {
      reply.raw.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frameBuf.length}\r\n\r\n`);
      reply.raw.write(frameBuf);
      reply.raw.write('\r\n');
    };

    cameraService.startStreamProcess(onFrame);

    request.raw.on('close', () => {
      cameraService.stopStream();
    });
  });
}
