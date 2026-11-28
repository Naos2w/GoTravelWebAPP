/**
 * Pure Node.js generator for GoTravel Nordic Slate PWA PNG icons.
 * Renders crisp 4x4 supersampled anti-aliased RGBA PNGs matching public/icon.svg.
 *
 * Usage: node scripts/generate-pwa-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

const LEFT_FACET = [
  [0, -108],
  [-15, -36],
  [-96, 36],
  [-22, 26],
  [-13, 62],
  [-40, 92],
  [0, 74],
];

const RIGHT_FACET = [
  [0, -108],
  [15, -36],
  [96, 36],
  [22, 26],
  [13, 62],
  [40, 92],
  [0, 74],
];

// Precompute quadratic Bezier trajectory M 96 416 Q 220 220 416 96 with cumulative lengths
const TRAJ_SEGMENTS = (() => {
  const steps = 80;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x = mt * mt * 96 + 2 * mt * t * 220 + t * t * 416;
    const y = mt * mt * 416 + 2 * mt * t * 220 + t * t * 96;
    pts.push([x, y]);
  }
  const segs = [];
  let accLen = 0;
  for (let i = 0; i < steps; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1);
    segs.push({ x1, y1, x2, y2, len, startLen: accLen });
    accLen += len;
  }
  return segs;
})();

const CARDINAL_TICKS = [
  [256, 58, 256, 72],
  [256, 440, 256, 454],
  [58, 256, 72, 256],
  [440, 256, 454, 256],
];

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { dist: Math.hypot(px - x1, py - y1), t: 0 };
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return {
    dist: Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)),
    t,
  };
}

function roundedRectSdf(vx, vy, radius) {
  const half = 256;
  const cx = Math.abs(vx - half) - (half - radius);
  const cy = Math.abs(vy - half) - (half - radius);
  return (
    Math.hypot(Math.max(cx, 0), Math.max(cy, 0)) +
    Math.min(Math.max(cx, cy), 0) -
    radius
  );
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function blendOver(baseR, baseG, baseB, overR, overG, overB, alpha) {
  return [
    baseR * (1 - alpha) + overR * alpha,
    baseG * (1 - alpha) + overG * alpha,
    baseB * (1 - alpha) + overB * alpha,
  ];
}

function sampleVirtualPixel(vx, vy, pixelWidth, { rounded, emblemScale }) {
  let maskAlpha = 1;
  let rimDist = -999;

  if (rounded) {
    rimDist = roundedRectSdf(vx, vy, 116);
    maskAlpha = Math.max(0, Math.min(1, 0.5 - rimDist / pixelWidth));
    if (maskAlpha <= 0) {
      return [0, 0, 0, 0];
    }
  }

  // Background gradient: #18283A -> #2E4E6E (0.55) -> #3B6B9B (1.0)
  const t = Math.max(0, Math.min(1, (vx + vy) / 1024));
  let r;
  let g;
  let b;
  if (t <= 0.55) {
    const k = t / 0.55;
    r = lerp(0x18, 0x2e, k);
    g = lerp(0x28, 0x4e, k);
    b = lerp(0x3a, 0x6e, k);
  } else {
    const k = (t - 0.55) / 0.45;
    r = lerp(0x2e, 0x3b, k);
    g = lerp(0x4e, 0x6b, k);
    b = lerp(0x6e, 0x9b, k);
  }

  // Subtle top specular sheen
  if (vy < 256) {
    const shineAlpha = 0.14 * (1 - vy / 256);
    [r, g, b] = blendOver(r, g, b, 255, 255, 255, shineAlpha);
  }

  // Full-bleed horizon meridian arc (cx=256, cy=488, r=340)
  let onBgHorizon = false;
  if (Math.abs(Math.hypot(vx - 256, vy - 488) - 340) <= 0.9) {
    onBgHorizon = true;
  }

  // Map to emblem space (scaled around center 256,256)
  const ex = (vx - 256) / emblemScale + 256;
  const ey = (vy - 256) / emblemScale + 256;

  // Radar & trajectory arcs at 0.12 opacity
  const halfStroke = 0.9 / emblemScale;
  let onArc = onBgHorizon;

  const dCenter = Math.hypot(ex - 256, ey - 256);
  // Outer radar circle (r=184)
  if (!onArc && Math.abs(dCenter - 184) <= halfStroke) {
    onArc = true;
  }

  // Inner dashed radar circle (r=128, dash 6, gap 8)
  if (!onArc && Math.abs(dCenter - 128) <= halfStroke) {
    const angle = Math.atan2(ey - 256, ex - 256) + Math.PI;
    const arcLen = angle * 128;
    if (arcLen % 14 < 6) {
      onArc = true;
    }
  }

  // Cardinal ticks on outer ring
  if (!onArc) {
    for (const [x1, y1, x2, y2] of CARDINAL_TICKS) {
      const { dist } = distToSegment(ex, ey, x1, y1, x2, y2);
      if (dist <= halfStroke) {
        onArc = true;
        break;
      }
    }
  }

  // Dashed SW-NE trajectory arc
  if (!onArc) {
    for (const seg of TRAJ_SEGMENTS) {
      const { dist, t: segT } = distToSegment(ex, ey, seg.x1, seg.y1, seg.x2, seg.y2);
      if (dist <= halfStroke) {
        const s = seg.startLen + segT * seg.len;
        if (s % 12 < 5) {
          onArc = true;
          break;
        }
      }
    }
  }

  if (onArc) {
    [r, g, b] = blendOver(r, g, b, 255, 255, 255, 0.12);
  }

  // Geometric jet / compass wing silhouette rotated +45deg around (256, 256)
  const dx = ex - 256;
  const dy = ey - 256;
  const lx = dx * Math.SQRT1_2 + dy * Math.SQRT1_2;
  const ly = -dx * Math.SQRT1_2 + dy * Math.SQRT1_2;

  if (pointInPoly(lx, ly, LEFT_FACET)) {
    r = 255;
    g = 255;
    b = 255;
  } else if (pointInPoly(lx, ly, RIGHT_FACET)) {
    r = 0xd8;
    g = 0xe4;
    b = 0xf0;
  }

  // Inner rim highlight for rounded squircle icon
  if (rounded && rimDist >= -1.8 && rimDist <= 0) {
    [r, g, b] = blendOver(r, g, b, 255, 255, 255, 0.14);
  }

  return [r, g, b, maskAlpha * 255];
}

// CRC32 table for PNG chunks
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type 0 (None)
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function renderIcon({ filename, size, rounded, emblemScale }) {
  const rgba = Buffer.alloc(size * size * 4);
  const subOffsets = [0.125, 0.375, 0.625, 0.875];
  const scaleToVirtual = 512 / size;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let sumA = 0;

      for (const oy of subOffsets) {
        const vy = (py + oy) * scaleToVirtual;
        for (const ox of subOffsets) {
          const vx = (px + ox) * scaleToVirtual;
          const [sr, sg, sb, sa] = sampleVirtualPixel(vx, vy, scaleToVirtual, {
            rounded,
            emblemScale,
          });
          const alphaNorm = sa / 255;
          sumR += sr * alphaNorm;
          sumG += sg * alphaNorm;
          sumB += sb * alphaNorm;
          sumA += sa;
        }
      }

      const avgA = sumA / 16;
      const idx = (py * size + px) * 4;
      if (avgA <= 0) {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
      } else {
        const norm = avgA / 255;
        rgba[idx] = Math.round(Math.min(255, sumR / 16 / norm));
        rgba[idx + 1] = Math.round(Math.min(255, sumG / 16 / norm));
        rgba[idx + 2] = Math.round(Math.min(255, sumB / 16 / norm));
        rgba[idx + 3] = Math.round(Math.min(255, avgA));
      }
    }
  }

  const png = encodePng(size, size, rgba);
  const outPath = path.join(PUBLIC_DIR, filename);
  fs.writeFileSync(outPath, png);
  console.log(`Generated ${filename}: ${size}x${size} (${png.length} bytes)`);
}

function verifyTarget({ filename, size, rounded }) {
  const outPath = path.join(PUBLIC_DIR, filename);
  const buf = fs.readFileSync(outPath);
  if (buf.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    throw new Error(`Invalid PNG signature in ${filename}`);
  }
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w !== size || h !== size) {
    throw new Error(`Dimension mismatch for ${filename}: ${w}x${h} !== ${size}x${size}`);
  }
  const idatIdx = buf.indexOf('IDAT');
  const iendIdx = buf.indexOf('IEND');
  const idatPayload = buf.subarray(idatIdx + 4, iendIdx - 8);
  const raw = zlib.inflateSync(idatPayload);
  const cornerAlpha = raw[4];
  const centerY = Math.floor(size / 2);
  const centerX = Math.floor(size / 2);
  const centerAlpha = raw[centerY * (size * 4 + 1) + 1 + centerX * 4 + 3];
  if (!rounded && cornerAlpha !== 255) {
    throw new Error(`${filename} corner must be opaque (255), got ${cornerAlpha}`);
  }
  if (rounded && cornerAlpha !== 0) {
    throw new Error(`${filename} outer corner must be transparent (0), got ${cornerAlpha}`);
  }
  if (centerAlpha !== 255) {
    throw new Error(`${filename} center must be opaque (255), got ${centerAlpha}`);
  }
  console.log(
    `Verified ${filename}: ${w}x${h}, ${buf.length} bytes, cornerAlpha=${cornerAlpha}, centerAlpha=${centerAlpha}`
  );
}

const TARGETS = [
  { filename: 'apple-touch-icon.png', size: 180, rounded: false, emblemScale: 0.94 },
  { filename: 'icon-192.png', size: 192, rounded: true, emblemScale: 1.0 },
  { filename: 'icon-512.png', size: 512, rounded: true, emblemScale: 1.0 },
  { filename: 'maskable-icon-512.png', size: 512, rounded: false, emblemScale: 0.62 },
];

for (const target of TARGETS) {
  renderIcon(target);
  verifyTarget(target);
}
