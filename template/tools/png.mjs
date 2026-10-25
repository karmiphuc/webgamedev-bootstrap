// Minimal dependency-free PNG decode/encode (Node built-ins only).
// Decodes: greyscale, RGB, palette, grey+alpha, RGBA; bit depths 1/2/4/8/16;
// tRNS transparency. Interlaced (Adam7) PNGs are rejected with a clear
// message: re-save them non-interlaced. Output is always 8-bit RGBA.

import { deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** @returns {{width:number,height:number,data:Uint8Array,info:{colorType:number,bitDepth:number,interlace:number,paletteSize:number}}} */
export function decodePng(buffer) {
  const buf = Buffer.from(buffer);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG file");
  let pos = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  let palette = null, trns = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === "PLTE") palette = body;
    else if (type === "tRNS") trns = body;
    else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
  }
  if (!width || !height) throw new Error("PNG has no IHDR");
  if (interlace) throw new Error("interlaced PNG not supported: re-save without interlacing");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported PNG colour type ${colorType}`);
  const bitsPerPixel = channels * bitDepth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const bpp = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const raw = inflateSync(Buffer.concat(idat));
  const lines = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = lines.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = src[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`bad PNG filter ${filter}`);
      out[i] = v & 0xff;
    }
    prev = out;
  }
  const sample = (row, index) => {
    // index = sample index within the row
    if (bitDepth === 8) return row[index];
    if (bitDepth === 16) return row[index * 2]; // keep high byte
    const perByte = 8 / bitDepth;
    const byte = row[Math.floor(index / perByte)];
    const shift = 8 - bitDepth * ((index % perByte) + 1);
    return (byte >> shift) & ((1 << bitDepth) - 1);
  };
  const scale = bitDepth < 8 && colorType !== 3 ? 255 / ((1 << bitDepth) - 1) : 1;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = lines.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (colorType === 3) {
        const idx = sample(row, x);
        data[o] = palette[idx * 3];
        data[o + 1] = palette[idx * 3 + 1];
        data[o + 2] = palette[idx * 3 + 2];
        data[o + 3] = trns && idx < trns.length ? trns[idx] : 255;
      } else if (colorType === 0 || colorType === 4) {
        const g = Math.round(sample(row, x * channels) * scale);
        data[o] = data[o + 1] = data[o + 2] = g;
        data[o + 3] = colorType === 4 ? sample(row, x * channels + 1) : 255;
        if (colorType === 0 && bitDepth <= 8 && trns && trns.readUInt16BE(0) === sample(row, x)) data[o + 3] = 0;
      } else {
        data[o] = sample(row, x * channels);
        data[o + 1] = sample(row, x * channels + 1);
        data[o + 2] = sample(row, x * channels + 2);
        data[o + 3] = colorType === 6 ? sample(row, x * channels + 3) : 255;
      }
    }
  }
  return { width, height, data, info: { colorType, bitDepth, interlace, paletteSize: palette ? palette.length / 3 : 0 } };
}

function chunk(type, body) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const typed = Buffer.concat([Buffer.from(type, "latin1"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

/** Encode 8-bit RGBA pixels. Deterministic output (same pixels = same bytes). */
export function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Pixel-art health metrics for one image or sub-rectangle. */
export function pixelStats(img, rect = { x: 0, y: 0, w: img.width, h: img.height }) {
  const colors = new Set();
  let softAlpha = 0, opaque = 0;
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const o = (y * img.width + x) * 4;
      const a = img.data[o + 3];
      if (a === 0) continue;
      if (a !== 255) softAlpha++;
      opaque++;
      colors.add((img.data[o] << 16) | (img.data[o + 1] << 8) | img.data[o + 2]);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return {
    colors: colors.size,
    softAlpha,
    opaque,
    bbox: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
  };
}
