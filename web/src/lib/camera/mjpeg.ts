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

const HEADER_SEARCH_BYTES = 1024; // part headers are < 200 bytes

export function createMjpegParser(onFrame: (jpeg: Uint8Array) => void) {
  // Pending bytes as a list of chunks: a frame is copied once, when it is complete,
  // instead of re-copying the whole buffer on every push.
  let chunks: Uint8Array[] = [];
  let pendingBytes = 0;
  const decoder = new TextDecoder();

  /** Copy the first `n` pending bytes into one new array (does not consume them). */
  function peek(n: number): Uint8Array {
    if (chunks[0].length >= n) return chunks[0].subarray(0, n);
    const out = new Uint8Array(n);
    let off = 0;
    for (const c of chunks) {
      if (off >= n) break;
      const take = Math.min(c.length, n - off);
      out.set(c.subarray(0, take), off);
      off += take;
    }
    return out;
  }

  /** Drop the first `n` pending bytes. */
  function skip(n: number) {
    pendingBytes -= n;
    while (n > 0) {
      const c = chunks[0];
      if (c.length <= n) {
        chunks.shift();
        n -= c.length;
      } else {
        chunks[0] = c.subarray(n);
        n = 0;
      }
    }
  }

  return {
    push(chunk: Uint8Array) {
      if (chunk.length === 0) return;
      chunks.push(chunk);
      pendingBytes += chunk.length;

      while (pendingBytes > 0) {
        let head = peek(Math.min(pendingBytes, HEADER_SEARCH_BYTES));
        let headerEnd = indexOfSeq(head, HEADER_END, 0);
        if (headerEnd === -1 && pendingBytes > HEADER_SEARCH_BYTES) {
          // Unusually long header (not sent by our server): search all pending bytes,
          // like the original parser did. Only a malformed stream pays this copy.
          head = peek(pendingBytes);
          headerEnd = indexOfSeq(head, HEADER_END, 0);
        }
        if (headerEnd === -1) break;

        const header = decoder.decode(head.subarray(0, headerEnd));
        const match = /Content-Length:\s*(\d+)/i.exec(header);
        const bodyStart = headerEnd + HEADER_END.length;
        if (!match) {
          // Malformed part — skip past this header and resync on the next one
          skip(bodyStart);
          continue;
        }

        const length = Number(match[1]);
        if (pendingBytes < bodyStart + length) break; // wait for more bytes

        skip(bodyStart);
        // The one copy per frame: a fresh array the caller owns.
        const frame = new Uint8Array(length);
        let off = 0;
        while (off < length) {
          const c = chunks[0];
          const take = Math.min(c.length, length - off);
          frame.set(c.subarray(0, take), off);
          off += take;
          skip(take);
        }
        onFrame(frame);
      }

      if (pendingBytes > MAX_BUFFER) {
        chunks = [];
        pendingBytes = 0;
      }
    },
  };
}
