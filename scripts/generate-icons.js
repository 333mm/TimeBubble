import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// CRC32 計算テーブル
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcTarget = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcTarget);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function generatePng(size) {
  const width = size;
  const height = size;

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // interlace

  // Raw image data with scanline filter (filter 0 = None)
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowSize);

  const center = size / 2;
  const radius = size * 0.44;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData.writeUInt8(0, rowOffset); // filter byte

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 背景: スムースな角丸四角またはサークル (紫色〜青色のグラデーション)
      // 角丸四角の距離判定
      const cornerRadius = size * 0.22;
      const qx = Math.max(0, Math.abs(dx) - (center - cornerRadius - 1));
      const qy = Math.max(0, Math.abs(dy) - (center - cornerRadius - 1));
      const cornerDist = Math.sqrt(qx * qx + qy * qy);

      if (cornerDist <= cornerRadius) {
        // グラデーション: #6366f1 (99, 102, 241) から #a855f7 (168, 85, 247)
        const t = (x + y) / (width + height);
        const r = Math.round(99 + (168 - 99) * t);
        const g = Math.round(102 + (85 - 102) * t);
        const b = Math.round(241 + (247 - 241) * t);

        // 吹き出しマーク / プレイマークの描画 (中央に白のプレイマーク三角形)
        const triX = (x - center) / (size * 0.5);
        const triY = (y - center) / (size * 0.5);

        // 三角形判定
        const inPlayButton = (triX > -0.3 && triX < 0.45 && Math.abs(triY) < (0.45 - triX * 0.5) * 0.9);

        if (inPlayButton) {
          rawData.writeUInt8(255, pxOffset);     // R
          rawData.writeUInt8(255, pxOffset + 1); // G
          rawData.writeUInt8(255, pxOffset + 2); // B
          rawData.writeUInt8(255, pxOffset + 3); // A
        } else {
          rawData.writeUInt8(r, pxOffset);
          rawData.writeUInt8(g, pxOffset + 1);
          rawData.writeUInt8(b, pxOffset + 2);
          rawData.writeUInt8(255, pxOffset + 3);
        }
      } else {
        // 透明
        rawData.writeUInt8(0, pxOffset);
        rawData.writeUInt8(0, pxOffset + 1);
        rawData.writeUInt8(0, pxOffset + 2);
        rawData.writeUInt8(0, pxOffset + 3);
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.resolve(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [16, 32, 48, 128];
for (const size of sizes) {
  const buf = generatePng(size);
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, buf);
  console.log(`Generated: ${filePath} (${size}x${size})`);
}
