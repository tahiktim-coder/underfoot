// node tools/zip.mjs OUT.zip FILE [FILE ...]
// A zip with the files at its root (by their base names), deflated, no tool outside Node. itch.io wants
// index.html at the root of the upload.
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const [out, ...files] = process.argv.slice(2);
if (!out || !files.length) { console.error('usage: node tools/zip.mjs OUT.zip FILE [FILE ...]'); process.exit(1); }

const TABLE = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };

const parts = [], central = [];
let offset = 0;
for (const f of files) {
  const data = fs.readFileSync(f), name = Buffer.from(path.basename(f), 'utf8');
  const packed = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data);
  const head = Buffer.concat([u32(0x04034b50), u16(20), u16(0x0800), u16(8), u16(dosTime), u16(dosDate), u32(crc), u32(packed.length), u32(data.length), u16(name.length), u16(0), name]);
  parts.push(head, packed);
  central.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(8), u16(dosTime), u16(dosDate), u32(crc), u32(packed.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
  offset += head.length + packed.length;
  console.log(`${path.basename(f)}: ${(data.length / 1024).toFixed(1)} KB -> ${(packed.length / 1024).toFixed(1)} KB`);
}
const cd = Buffer.concat(central);
const end = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(cd.length), u32(offset), u16(0)]);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([...parts, cd, end]));
console.log(out, (fs.statSync(out).size / 1024).toFixed(1) + ' KB');
