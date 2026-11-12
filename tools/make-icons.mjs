#!/usr/bin/env node
// Vygeneruje ikony aplikace (Σ na barvě aplikace) do složky icons/ bez jakýchkoli závislostí.
// Použití (z kořene projektu):  node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const BG = [0x17, 0x60, 0x6e];   // --accent
const FG = [0xfb, 0xfb, 0xf9];   // --surface
const SEGMENTS = [[0.29, 0.27, 0.71, 0.27], [0.29, 0.27, 0.5, 0.5], [0.5, 0.5, 0.29, 0.73], [0.29, 0.73, 0.71, 0.73]];
const HALF_STROKE = 0.04;

function distToSegment(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1; const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
const glyph = (x, y) => SEGMENTS.some((s) => distToSegment(x, y, s) <= HALF_STROKE);
// Zaoblený čtverec (pro běžné ikony); maskable a Apple ikona jsou přes celou plochu.
function inRounded(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r); const cy = Math.min(Math.max(y, r), 1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

function crc32(buf) {
  let c; let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function makePng(size, { rounded }) {
  const SS = 4;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let bgCov = 0; let fgCov = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const u = (x + (sx + 0.5) / SS) / size; const v = (y + (sy + 0.5) / SS) / size;
        if (!rounded || inRounded(u, v, 0.22)) { bgCov++; if (glyph(u, v)) fgCov++; }
      }
      const n = SS * SS;
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const a = bgCov / n;
      const f = bgCov ? fgCov / bgCov : 0;
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(BG[i] * (1 - f) + FG[i] * f);
      raw[o + 3] = Math.round(a * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dir = fileURLToPath(new URL('../icons/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  const jobs = [['icon-192.png', 192, true], ['icon-512.png', 512, true], ['icon-maskable-512.png', 512, false], ['apple-touch-icon.png', 180, false]];
  for (const [name, size, rounded] of jobs) writeFileSync(join(dir, name), makePng(size, { rounded }));
  console.log('Ikony vytvořeny ve složce icons/');
}
