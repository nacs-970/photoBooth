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
      'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Connection': 'close'
    });

    const onFrame = (frameBuf: Buffer) => {
      // Drop frames for a slow client instead of buffering them — buffered frames become lag.
      if (reply.raw.writableNeedDrain || reply.raw.writableEnded) return;
      reply.raw.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frameBuf.length}\r\n\r\n`);
      reply.raw.write(frameBuf);
      reply.raw.write('\r\n');
    };

    // Each connection only removes its own listener, so an old connection closing
    // after a reconnect cannot stop the new stream.
    const unsubscribe = cameraService.subscribe(onFrame, () => reply.raw.end());

    request.raw.on('close', unsubscribe);
  });

  app.post('/api/camera/capture', async (request, reply) => {
    const { shotIndex, sessionId } = request.body as { shotIndex: unknown; sessionId: unknown };
    
    const idx = Number(shotIndex);
    if (!Number.isInteger(idx) || idx < 0) {
      return reply.code(400).send('Invalid shotIndex');
    }

    const sid = Number(sessionId);
    if (!Number.isInteger(sid) || sid < 1_000_000_000_000 || sid > Date.now() + 60_000) {
      return reply.code(400).send('Invalid sessionId');
    }

    const buffer = await cameraService.capture(sid, idx);
    reply.header('Content-Type', 'image/jpeg');
    return reply.send(buffer);
  });
}
