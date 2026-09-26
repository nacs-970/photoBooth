import { describe, it, expect, vi, afterEach } from 'vitest';
import { createMjpegParser } from './mjpeg.ts';

const enc = new TextEncoder();

function part(bytes: number[]): Uint8Array {
  const head = enc.encode(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${bytes.length}\r\n\r\n`);
  const out = new Uint8Array(head.length + bytes.length + 2);
  out.set(head);
  out.set(bytes, head.length);
  out.set([13, 10], head.length + bytes.length);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

describe('createMjpegParser', () => {
  it('emits each frame from a single chunk', () => {
    const frames: number[][] = [];
    const parser = createMjpegParser((f) => frames.push([...f]));
    parser.push(concat(part([0xff, 0xd8, 1, 0xff, 0xd9]), part([0xff, 0xd8, 2, 0xff, 0xd9])));
    expect(frames).toEqual([[0xff, 0xd8, 1, 0xff, 0xd9], [0xff, 0xd8, 2, 0xff, 0xd9]]);
  });

  it('reassembles frames split across arbitrary chunk boundaries', () => {
    const frames: number[][] = [];
    const parser = createMjpegParser((f) => frames.push([...f]));
    const stream = concat(part([0xff, 0xd8, 13, 10, 13, 10, 0xff, 0xd9]), part([0xff, 0xd8, 7, 0xff, 0xd9]));
    for (let i = 0; i < stream.length; i += 3) parser.push(stream.slice(i, i + 3));
    expect(frames).toEqual([[0xff, 0xd8, 13, 10, 13, 10, 0xff, 0xd9], [0xff, 0xd8, 7, 0xff, 0xd9]]);
  });

  it('waits for the full body before emitting', () => {
    const frames: Uint8Array[] = [];
    const parser = createMjpegParser((f) => frames.push(f));
    const p = part([1, 2, 3, 4]);
    parser.push(p.slice(0, p.length - 4));
    expect(frames).toHaveLength(0);
    parser.push(p.slice(p.length - 4));
    expect(frames).toHaveLength(1);
  });

  it('reassembles a 200 KB body delivered in 16 KB chunks into one identical frame', () => {
    const body = new Uint8Array(200 * 1024);
    for (let i = 0; i < body.length; i++) body[i] = (i * 31 + 7) & 0xff;
    const frames: Uint8Array[] = [];
    const parser = createMjpegParser((f) => frames.push(f));
    const stream = part([...body]);
    for (let i = 0; i < stream.length; i += 16 * 1024) parser.push(stream.slice(i, i + 16 * 1024));
    expect(frames).toHaveLength(1);
    expect(frames[0].length).toBe(body.length);
    expect(frames[0]).toEqual(body);
  });

  describe('decoder reuse', () => {
    afterEach(() => { vi.unstubAllGlobals(); });

    it('creates one TextDecoder per parser, not one per part', () => {
      // Counting subclass: keeps the real decode() so the parser still works.
      let created = 0;
      vi.stubGlobal('TextDecoder', class extends TextDecoder {
        constructor(...args: ConstructorParameters<typeof TextDecoder>) { super(...args); created++; }
      });
      const frames: number[][] = [];
      const parser = createMjpegParser((f) => frames.push([...f]));
      parser.push(concat(part([1]), part([2]), part([3])));
      expect(frames).toEqual([[1], [2], [3]]);
      expect(created).toBe(1);
    });
  });
});
