import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), "../src-tauri/icons");
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngSize(buffer, label, expectedSize) {
  assert(buffer.length >= 29, `${label}: PNG header is truncated`);
  assert(buffer.subarray(0, 8).equals(pngSignature), `${label}: invalid PNG signature`);
  assert.equal(buffer.toString("ascii", 12, 16), "IHDR", `${label}: missing IHDR`);

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  assert.equal(width, expectedSize, `${label}: expected width ${expectedSize}, got ${width}`);
  assert.equal(height, expectedSize, `${label}: expected height ${expectedSize}, got ${height}`);
  assert.equal(buffer[24], 8, `${label}: expected 8-bit channels`);
  assert.equal(buffer[25], 6, `${label}: expected RGBA color type`);
}

for (const [name, size] of [
  ["32x32.png", 32],
  ["128x128.png", 128],
  ["128x128@2x.png", 256],
  ["icon.png", 512],
]) {
  readPngSize(readFileSync(join(iconsDir, name)), name, size);
}

const ico = readFileSync(join(iconsDir, "icon.ico"));
assert(ico.length >= 6, "icon.ico: header is truncated");
assert.equal(ico.readUInt16LE(0), 0, "icon.ico: reserved field must be zero");
assert.equal(ico.readUInt16LE(2), 1, "icon.ico: file type must be 1 (ICO)");

const entryCount = ico.readUInt16LE(4);
assert(entryCount >= 6, `icon.ico: expected at least 6 size entries, got ${entryCount}`);

const icoSizes = [];
for (let index = 0; index < entryCount; index += 1) {
  const entryOffset = 6 + index * 16;
  assert(entryOffset + 16 <= ico.length, "icon.ico: truncated directory entry");

  const width = ico[entryOffset] || 256;
  const height = ico[entryOffset + 1] || 256;
  const payloadSize = ico.readUInt32LE(entryOffset + 8);
  const payloadOffset = ico.readUInt32LE(entryOffset + 12);
  assert(payloadSize > 0, `icon.ico: empty payload for ${width}x${height}`);
  assert(payloadOffset + payloadSize <= ico.length, `icon.ico: payload out of bounds for ${width}x${height}`);
  assert.equal(width, height, `icon.ico: non-square entry ${width}x${height}`);
  icoSizes.push(width);
}

for (const size of [16, 24, 32, 48, 64, 256]) {
  assert(icoSizes.includes(size), `icon.ico: missing ${size}x${size} entry`);
}

const icns = readFileSync(join(iconsDir, "icon.icns"));
assert(icns.length >= 8, "icon.icns: header is truncated");
assert.equal(icns.toString("ascii", 0, 4), "icns", "icon.icns: invalid signature");
assert.equal(icns.readUInt32BE(4), icns.length, "icon.icns: container length does not match file size");

const chunks = new Map();
let offset = 8;
while (offset < icns.length) {
  assert(offset + 8 <= icns.length, "icon.icns: truncated chunk header");
  const type = icns.toString("ascii", offset, offset + 4);
  const chunkLength = icns.readUInt32BE(offset + 4);
  assert(chunkLength >= 8, `icon.icns: invalid length for ${type}`);
  assert(offset + chunkLength <= icns.length, `icon.icns: chunk ${type} extends beyond file`);
  chunks.set(type, chunkLength);
  offset += chunkLength;
}
assert.equal(offset, icns.length, "icon.icns: trailing or malformed chunk data");

for (const type of ["is32", "ic11", "il32", "ic12", "ic07", "ic13", "ic08", "ic14", "ic09", "ic10"]) {
  assert(chunks.has(type), `icon.icns: missing Tauri icon layer ${type}`);
}

console.log("Tauri platform icons are valid: PNG dimensions, ICO layers, and ICNS layers checked.");
