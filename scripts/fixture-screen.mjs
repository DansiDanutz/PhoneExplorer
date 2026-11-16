import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

/** Minimal PNG encoder used to build a deterministic fake device screen. */
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

export function writeFakeScreen(path, width = 1080, height = 2400) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    const t = y / height;
    const baseR = Math.round(10 + 18 * t);
    const baseG = Math.round(26 + 26 * t);
    const baseB = Math.round(20 + 16 * t);
    for (let x = 0; x < width; x += 1) {
      const offset = rowStart + 1 + x * 4;
      let r = baseR;
      let g = baseG;
      let b = baseB;
      // Faint 90px grid.
      if (x % 90 === 0 || y % 90 === 0) {
        r += 8;
        g += 16;
        b += 10;
      }
      // A lime status strip and a large soft card.
      if (y < 120) {
        r = 18;
        g = 34;
        b = 24;
      }
      const cardX = 70;
      const cardY = 420;
      const cardW = width - 140;
      const cardH = 560;
      if (x > cardX && x < cardX + cardW && y > cardY && y < cardY + cardH) {
        const glow = 1 - Math.abs(x - (cardX + cardW / 2)) / (cardW / 2);
        r = Math.round(18 + 20 * glow);
        g = Math.round(40 + 46 * glow);
        b = Math.round(30 + 28 * glow);
      }
      if (y > 1100 && y < 1120 && x > 70 && x < width - 70) {
        r = 216;
        g = 255;
        b = 99;
      }
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
  return png;
}
