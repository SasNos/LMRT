// Generates icons/16|32|48|128.png: accent circle with a white play triangle. Run: node scripts/make-icons.js
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc(body), body.length + 4);
  return out;
};

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const c = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const inCircle = (x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2 <= (c - 0.5) ** 2;
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;
      const inTriangle = u > 0.38 && u < 0.72 && Math.abs(v - 0.5) < (0.72 - u) * 0.75;
      const px = !inCircle ? [0, 0, 0, 0] : inTriangle ? [255, 255, 255, 255] : [11, 92, 173, 255];
      raw.set(px, o);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync("icons", { recursive: true });
for (const size of [16, 32, 48, 128]) writeFileSync(`icons/${size}.png`, png(size));
