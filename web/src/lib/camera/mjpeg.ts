/**
 * Incremental parser for the backend's multipart/x-mixed-replace MJPEG stream.
 *
 * Wire format per part (server/src/routes/camera.ts):
 *   --frame\r\nContent-Type: image/jpeg\r\nContent-Length: N\r\n\r\n<N bytes>\r\n
 *
 * push() accepts arbitrary chunk boundaries and calls onFrame once per complete JPEG.
 */
const HEADER_END = [13, 10, 13, 10]; // \r\n\r\n
const MAX_BUFFER = 8 * 1024 * 1024;

function indexOfSeq(buf: Uint8Array, seq: number[], from: number): number {
  outer: for (let i = from; i <= buf.length - seq.length; i++) {
    for (let j = 0; j < seq.length; j++) {
      if (buf[i + j] !== seq[j]) continue outer;
    }
    return i;
  }
  return -1;
}

export function createMjpegParser(onFrame: (jpeg: Uint8Array) => void) {
  let buf: Uint8Array = new Uint8Array(0);

  return {
    push(chunk: Uint8Array) {
      if (buf.length === 0) {
        buf = chunk;
      } else {
        const merged = new Uint8Array(buf.length + chunk.length);
        merged.set(buf);
        merged.set(chunk, buf.length);
        buf = merged;
      }

      for (;;) {
        const headerEnd = indexOfSeq(buf, HEADER_END, 0);
        if (headerEnd === -1) break;

        const header = new TextDecoder().decode(buf.subarray(0, headerEnd));
        const match = /Content-Length:\s*(\d+)/i.exec(header);
        const bodyStart = headerEnd + HEADER_END.length;
        if (!match) {
          // Malformed part — skip past this header and resync on the next one
          buf = buf.subarray(bodyStart);
          continue;
        }

        const length = Number(match[1]);
        if (buf.length < bodyStart + length) break; // wait for more bytes

        onFrame(buf.slice(bodyStart, bodyStart + length));
        buf = buf.subarray(bodyStart + length);
      }

      if (buf.length > MAX_BUFFER) buf = new Uint8Array(0);
    },
  };
}
