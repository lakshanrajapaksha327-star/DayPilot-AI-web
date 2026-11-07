import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  let c = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  }
  return (c ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

function createPng(width, height, getPixel) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixel(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

// Distance helper
function dist(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

// Rounded rect helper
function inRoundedRect(x, y, rx, ry, rw, rh, rad) {
  if (x < rx || x > rx + rw || y < ry || y > ry + rh) return false;
  // Check corners
  if (x < rx + rad && y < ry + rad) return dist(x, y, rx + rad, ry + rad) <= rad;
  if (x > rx + rw - rad && y < ry + rad) return dist(x, y, rx + rw - rad, ry + rad) <= rad;
  if (x < rx + rad && y > ry + rh - rad) return dist(x, y, rx + rad, ry + rh - rad) <= rad;
  if (x > rx + rw - rad && y > ry + rh - rad) return dist(x, y, rx + rw - rad, ry + rh - rad) <= rad;
  return true;
}

// 4-point Diamond Star calculation
function inStar(nx, ny, cx, cy, radius, concavity = 0.3) {
  const dx = Math.abs(nx - cx) / radius;
  const dy = Math.abs(ny - cy) / radius;
  if (dx > 1 || dy > 1) return false;
  // Astroid equation: x^(2/3) + y^(2/3) <= 1 or polynomial approx
  return Math.pow(dx, 0.5) + Math.pow(dy, 0.5) <= 1.0;
}

function renderDayPilotIcon(x, y, w, h, isMaskable = false) {
  // Normalize coordinates to 0..1
  let nx = x / w;
  let ny = y / h;

  // For maskable icon: scale down content to 0.75 and center to guarantee 15% safe padding
  if (isMaskable) {
    const scale = 0.76;
    nx = (nx - 0.5) / scale + 0.5;
    ny = (ny - 0.5) / scale + 0.5;
  }

  // Deep canvas background (Full-bleed #030712 to #0b1329)
  const bgGrad = Math.min(1, Math.max(0, (y / h) * 0.7 + (x / w) * 0.3));
  const bgR = Math.round(2 + bgGrad * 9);
  const bgG = Math.round(6 + bgGrad * 13);
  const bgB = Math.round(23 + bgGrad * 25);

  // If outside squircle for regular icon
  if (!isMaskable) {
    const cornerRad = 0.22;
    if (!inRoundedRect(nx, ny, 0.02, 0.02, 0.96, 0.96, cornerRad)) {
      return [0, 0, 0, 0]; // Transparent outer
    }
  }

  // Base canvas color
  let r = bgR;
  let g = bgG;
  let b = bgB;
  let a = 255;

  // If inside normalized bounds
  if (nx >= 0 && nx <= 1 && ny >= 0 && ny <= 1) {
    // 1. Calendar Body
    const calX = 0.18, calY = 0.22, calW = 0.64, calH = 0.60, calRad = 0.06;
    if (inRoundedRect(nx, ny, calX, calY, calW, calH, calRad)) {
      // Dark slate card fill
      r = 15; g = 23; b = 42;

      // 2. Calendar Header (Top 26% of calendar)
      if (ny <= calY + 0.15) {
        // Gradient from #2563eb (blue) to #06b6d4 (cyan)
        const hGrad = (nx - calX) / calW;
        r = Math.round(37 + hGrad * (6 - 37));
        g = Math.round(99 + hGrad * (182 - 99));
        b = Math.round(235 + hGrad * (212 - 235));
      } else {
        // Calendar Grid Dots
        const dots = [
          [0.30, 0.46], [0.42, 0.46], [0.58, 0.46], [0.70, 0.46],
          [0.30, 0.58], [0.70, 0.58],
          [0.30, 0.70], [0.42, 0.70], [0.58, 0.70], [0.70, 0.70],
        ];
        for (const [dotX, dotY] of dots) {
          if (dist(nx, ny, dotX, dotY) < 0.022) {
            r = 51; g = 65; b = 85;
          }
        }
      }

      // Border outline for calendar card
      if (
        nx < calX + 0.01 || nx > calX + calW - 0.01 ||
        ny < calY + 0.01 || ny > calY + calH - 0.01
      ) {
        r = 51; g = 65; b = 85;
      }
    }

    // Binder clips
    const clip1 = inRoundedRect(nx, ny, 0.31, 0.17, 0.045, 0.10, 0.02);
    const clip2 = inRoundedRect(nx, ny, 0.64, 0.17, 0.045, 0.10, 0.02);
    if (clip1 || clip2) {
      r = 248; g = 250; b = 252;
    }

    // 3. Central AI Sparkle Star (cx=0.50, cy=0.58)
    const starRadius = 0.17;
    const starCenter = [0.50, 0.58];

    // Glow halo
    const glowDist = dist(nx, ny, starCenter[0], starCenter[1]);
    if (glowDist < 0.16) {
      const glowAlpha = Math.max(0, 1 - glowDist / 0.16) * 0.45;
      r = Math.round(r * (1 - glowAlpha) + 56 * glowAlpha);
      g = Math.round(g * (1 - glowAlpha) + 189 * glowAlpha);
      b = Math.round(b * (1 - glowAlpha) + 248 * glowAlpha);
    }

    // Main 4-point Diamond Star
    if (inStar(nx, ny, starCenter[0], starCenter[1], starRadius)) {
      // Star gradient (#38bdf8 to #c084fc)
      const sGrad = (nx - (starCenter[0] - starRadius)) / (starRadius * 2);
      r = Math.round(56 + sGrad * (192 - 56));
      g = Math.round(189 + sGrad * (132 - 189));
      b = Math.round(248 + sGrad * (252 - 248));

      // Inner brilliant white core
      if (inStar(nx, ny, starCenter[0], starCenter[1], starRadius * 0.45)) {
        r = 255; g = 255; b = 255;
      }
    }

    // Mini star at header right
    if (inStar(nx, ny, 0.72, 0.28, 0.045)) {
      r = 255; g = 255; b = 255;
    }
  }

  return [r, g, b, a];
}

const outDir = path.resolve('public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Generating PWA icons...');

// 1. icon-192.png
const png192 = createPng(192, 192, (x, y, w, h) => renderDayPilotIcon(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'icon-192.png'), png192);
console.log('✓ Created public/icons/icon-192.png');

// 2. icon-512.png
const png512 = createPng(512, 512, (x, y, w, h) => renderDayPilotIcon(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), png512);
console.log('✓ Created public/icons/icon-512.png');

// 3. icon-maskable-512.png
const pngMaskable = createPng(512, 512, (x, y, w, h) => renderDayPilotIcon(x, y, w, h, true));
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), pngMaskable);
console.log('✓ Created public/icons/icon-maskable-512.png');

// 4. apple-touch-icon.png (180x180)
const appleIcon = createPng(180, 180, (x, y, w, h) => renderDayPilotIcon(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), appleIcon);
fs.writeFileSync(path.resolve('public/apple-touch-icon.png'), appleIcon);
console.log('✓ Created public/icons/apple-touch-icon.png and public/apple-touch-icon.png');

// 5. favicon.png (32x32)
const favIcon = createPng(32, 32, (x, y, w, h) => renderDayPilotIcon(x, y, w, h, false));
fs.writeFileSync(path.resolve('public/favicon.png'), favIcon);
console.log('✓ Created public/favicon.png');

console.log('All icons successfully generated!');
