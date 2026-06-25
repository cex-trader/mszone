// Generates icon-192.png and icon-512.png — pure Node.js, no deps
// Optimized for Chrome PWA (Maskable Icon Standard)
const zlib = require('zlib');
const fs = require('fs');

// ♬ double eighth notes — deep indigo bg, gold with metallic highlight
const BG_CTR    = [26, 22, 58];    // deep violet-indigo center
const BG_EDG    = [9, 9, 18];      // near-black edge
const GOLD_HI   = [255, 228, 78];  // bright gold (top)
const GOLD_LO   = [208, 134, 6];   // amber (bottom)
const GOLD_GLOW = [255, 252, 200]; // white-gold specular highlight

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// 预计算不变的 CRC32 查找表，避免重复计算
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) | 0;
}

// 针对 PWA 桌面图标优化过的渲染器生成器
function createRenderer(w) {
  const s = w / 512;
  const cx = w / 2;
  const bgMaxDist = cx * 1.414;

  const angle = -22 * Math.PI / 180;
  const cosA  = Math.cos(angle);
  const sinA  = Math.sin(angle);
  
  // 【视觉优化】整体音符等比例放大约 12%，使其在没有外圈后更显眼，且依然在 80% 安全区内
  const scaleFactor = 1.12;
  const ra = 54 * s * scaleFactor, rb = 36 * s * scaleFactor;
  const ra2 = ra * ra, rb2 = rb * rb;
  
  const sra = ra * 0.44, srb = rb * 0.40;
  const sra2 = sra * sra, srb2 = srb * srb;
  const oxOffset = ra * 0.30, oyOffset = rb * 0.36;

  const stemR  = 10.5 * s * scaleFactor;
  const beam1R = 17 * s * scaleFactor;
  const beam2R = 13 * s * scaleFactor;
  const beam2Y = 50 * s * scaleFactor;

  // 【居中微调】因为放大了，对坐标进行了微调，确保质心始终在 (256, 256) 绝对中心
  const h1x = (183 - 2) * s, h1y = (330 + 5) * s;
  const h2x = (320 - 2) * s, h2y = (305 + 5) * s;

  const stX1 = (237 - 2) * s, stT1 = (183 + 5) * s, stB1 = (332 + 5) * s;
  const stX2 = (374 - 2) * s, stT2 = (157 + 5) * s, stB2 = (307 + 5) * s;
  
  const goldDenom = (stB1 + rb - stT2 + beam1R);
  const goldTopY = stT2 - beam1R;

  // 胶囊体几何数据预缓存
  function precomputePill(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    return { ax, ay, dx, dy, len2: dx * dx + dy * dy };
  }
  const p1 = precomputePill(stX1, stT1, stX1, stB1);
  const p2 = precomputePill(stX2, stT2, stX2, stB2);
  const p3 = precomputePill(stX1, stT1, stX2, stT2);
  const p4 = precomputePill(stX1, stT1 + beam2Y, stX2, stT2 + beam2Y);

  function inHead(fx, fy, hx, hy) {
    const dx = fx - hx, dy = fy - hy;
    const lx = dx * cosA + dy * sinA;
    const ly = -dx * sinA + dy * cosA;
    return (lx * lx) / ra2 + (ly * ly) / rb2 <= 1;
  }

  function inShine(fx, fy, hx, hy) {
    const dx = fx - (hx - oxOffset), dy = fy - (hy - oyOffset);
    const lx = dx * cosA + dy * sinA;
    const ly = -dx * sinA + dy * cosA;
    return (lx * lx) / sra2 + (ly * ly) / srb2 <= 1;
  }

  function inPill(fx, fy, p, r) {
    const t = clamp(((fx - p.ax) * p.dx + (fy - p.ay) * p.dy) / p.len2, 0, 1);
    const nx = p.ax + t * p.dx - fx, ny = p.ay + t * p.dy - fy;
    return nx * nx + ny * ny <= r * r;
  }

  return function(fx, fy) {
    // 1. 渲染优雅的深蓝径向渐变背景
    const dx = fx - cx, dy = fy - cx;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const bgT  = clamp(dist / bgMaxDist, 0, 1) ** 2;
    const bgR  = Math.round(lerp(BG_CTR[0], BG_EDG[0], bgT));
    const bgG  = Math.round(lerp(BG_CTR[1], BG_EDG[1], bgT));
    const bgB  = Math.round(lerp(BG_CTR[2], BG_EDG[2], bgT));

    let inNote = false, isShine = false;
    
    // 2. 碰撞检测
    if (inHead(fx, fy, h1x, h1y)) {
      inNote = true; isShine = inShine(fx, fy, h1x, h1y);
    } else if (inHead(fx, fy, h2x, h2y)) {
      inNote = true; isShine = inShine(fx, fy, h2x, h2y);
    } else if (
      inPill(fx, fy, p1, stemR) ||
      inPill(fx, fy, p2, stemR) ||
      inPill(fx, fy, p3, beam1R) ||
      inPill(fx, fy, p4, beam2R)
    ) {
      inNote = true;
    }

    // PWA 图标优化：移除原有的外圈发光，确保背景平滑延伸到边缘
    if (!inNote) {
      return [bgR, bgG, bgB];
    }

    // 3. 渲染金属音符的黄金垂直渐变与高光
    const gy = clamp((fy - goldTopY) / goldDenom, 0, 1);
    let gR = lerp(GOLD_HI[0], GOLD_LO[0], gy * 0.62);
    let gG = lerp(GOLD_HI[1], GOLD_LO[1], gy * 0.62);
    let gB = lerp(GOLD_HI[2], GOLD_LO[2], gy * 0.62);

    if (isShine) {
      gR = lerp(gR, GOLD_GLOW[0], 0.40);
      gG = lerp(gG, GOLD_GLOW[1], 0.40);
      gB = lerp(gB, GOLD_GLOW[2], 0.40);
    }

    return [Math.round(gR), Math.round(gG), Math.round(gB)];
  };
}

function makePNG(size) {
  const AA  = 3; // 3x3 SSAO 超采样抗锯齿
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB 无 Alpha 通道（PWA桌面背景全填充规范）

  const raw = Buffer.alloc(size * (1 + size * 3));
  const getColorAt = createRenderer(size);

  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0; // Filter type: None
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let si = 0; si < AA; si++) {
        for (let sj = 0; sj < AA; sj++) {
          const [cr, cg, cb] = getColorAt(x + (si + 0.5) / AA, y + (sj + 0.5) / AA);
          r += cr; g += cg; b += cb;
        }
      }
      const n = AA * AA;
      const o = y * (1 + size * 3) + 1 + x * 3;
      raw[o]     = Math.round(r / n);
      raw[o + 1] = Math.round(g / n);
      raw[o + 2] = Math.round(b / n);
    }
  }

  const idat = zlib.deflateSync(raw, { level: 9 });

  function chunk(type, data) {
    const b = Buffer.alloc(12 + data.length);
    b.writeUInt32BE(data.length, 0);
    b.write(type, 4, 'ascii');
    data.copy(b, 8);
    b.writeInt32BE(crc32(b.subarray(4, 8 + data.length)), 8 + data.length);
    return b;
  }

  // 写入 sRGB 块（值为0表示 Perceptual），强制浏览器和操作系统按标准颜色渲染，防止广色域屏幕偏色
  const srgbChunk = chunk('sRGB', Buffer.from([0]));

  return Buffer.concat([
    sig, 
    chunk('IHDR', ihdr), 
    srgbChunk, 
    chunk('IDAT', idat), 
    chunk('IEND', Buffer.alloc(0))
  ]);
}

fs.writeFileSync('icon-192.png', makePNG(192));
fs.writeFileSync('icon-512.png', makePNG(512));
console.log('✅ Success: icon-192.png & icon-512.png generated for PWA!');