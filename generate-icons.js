// Generates icon-192.png and icon-512.png — pure Node.js, no deps
const zlib = require('zlib');
const fs = require('fs');

const BG  = [13, 15, 23];      // #0d0f17
const FG  = [255, 203, 46];    // #ffcb2e
const FG2 = [245, 180, 0];     // #f5b400 (shadow tint)

function getPixel(x, y, w, h) {
  const cx = w / 2, cy = h / 2;

  // Outer glow ring (subtle)
  const ringR = w * 0.46, ringW = w * 0.015;
  const dr = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  if (dr > ringR && dr < ringR + ringW) {
    const t = 1 - (dr - ringR) / ringW;
    return FG.map((c, i) => Math.round(BG[i] + (c - BG[i]) * t * 0.25));
  }

  // 4 equalizer bars — centered
  const barW   = Math.round(w * 0.10);
  const barGap = Math.round(w * 0.045);
  const total  = 4 * barW + 3 * barGap;
  const sx     = Math.round((w - total) / 2);
  const maxH   = Math.round(h * 0.52);
  const bots   = Math.round(h * 0.63);
  const ratios = [0.52, 0.82, 1.0, 0.68];

  for (let i = 0; i < 4; i++) {
    const bx = sx + i * (barW + barGap);
    const bh = Math.round(maxH * ratios[i]);
    const top = bots - bh;
    const rad = Math.round(barW / 2);

    if (x < bx || x >= bx + barW) continue;

    // Rounded top cap
    const topCapCy = top + rad;
    const dx = x - (bx + rad), dy = y - topCapCy;
    const inCap = dx * dx + dy * dy <= rad * rad;

    if (inCap && y <= topCapCy) return FG;
    if (y >= top + rad && y < bots) return FG;
  }

  return BG;
}

function makePNG(size) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;

  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = getPixel(x, y, size, size);
      const o = y * (1 + size * 3) + 1 + x * 3;
      raw[o] = r; raw[o+1] = g; raw[o+2] = b;
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });

  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c;
  }
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) | 0;
  }
  function chunk(type, data) {
    const b = Buffer.alloc(12 + data.length);
    b.writeUInt32BE(data.length, 0);
    b.write(type, 4, 'ascii');
    data.copy(b, 8);
    b.writeInt32BE(crc32(b.slice(4, 8 + data.length)), 8 + data.length);
    return b;
  }

  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

fs.writeFileSync('icon-192.png', makePNG(192));
fs.writeFileSync('icon-512.png', makePNG(512));
console.log('icon-192.png  icon-512.png  generated');
