import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, 'public', 'favicon.svg');
const icoPath = path.join(projectRoot, 'src', 'app', 'favicon.ico');
const ogImagePath = path.join(projectRoot, 'public', 'og-image.png');
const versionedOgImagePath = path.join(
  projectRoot,
  'public',
  'og-image-ethereum-tesseract.png',
);
const sourceSvg = await readFile(sourcePath);

const iconSizes = [16, 32, 48, 64];
const iconPngs = await Promise.all(
  iconSizes.map((size) =>
    sharp(sourceSvg)
      .resize(size, size, { fit: 'contain' })
      .png()
      .toBuffer(),
  ),
);

const headerSize = 6;
const directoryEntrySize = 16;
let imageOffset = headerSize + directoryEntrySize * iconPngs.length;
const icoHeader = Buffer.alloc(headerSize);
icoHeader.writeUInt16LE(0, 0);
icoHeader.writeUInt16LE(1, 2);
icoHeader.writeUInt16LE(iconPngs.length, 4);

const directoryEntries = iconPngs.map((png, index) => {
  const size = iconSizes[index];
  const entry = Buffer.alloc(directoryEntrySize);
  entry.writeUInt8(size, 0);
  entry.writeUInt8(size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(imageOffset, 12);
  imageOffset += png.length;
  return entry;
});

await writeFile(icoPath, Buffer.concat([icoHeader, ...directoryEntries, ...iconPngs]));

const encodedLogo = sourceSvg.toString('base64');
const ogSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1200" y2="630">
        <stop offset="0" stop-color="#070610"/>
        <stop offset=".5" stop-color="#10102a"/>
        <stop offset="1" stop-color="#180a2b"/>
      </linearGradient>
      <radialGradient id="glow">
        <stop offset="0" stop-color="#7c3aed" stop-opacity=".38"/>
        <stop offset="1" stop-color="#7c3aed" stop-opacity="0"/>
      </radialGradient>
      <pattern id="grid" width="54" height="54" patternUnits="userSpaceOnUse">
        <path d="M54 0H0V54" fill="none" stroke="#c4b5fd" stroke-opacity=".08"/>
      </pattern>
    </defs>
    <rect width="1200" height="630" fill="url(#background)"/>
    <rect width="1200" height="630" fill="url(#grid)"/>
    <circle cx="925" cy="310" r="300" fill="url(#glow)"/>
    <text x="86" y="108" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700">crypto.me</text>
    <text x="86" y="252" fill="#f8fafc" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="800" letter-spacing="-3">Every signal.</text>
    <text x="86" y="335" fill="#a78bfa" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="800" letter-spacing="-3">One identity.</text>
    <text x="90" y="415" fill="#a8a4b8" font-family="Arial, Helvetica, sans-serif" font-size="27">Identity · Social · Messaging · Tokens · NFTs</text>
    <text x="90" y="525" fill="#c4b5fd" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" letter-spacing="4">YOUR ONCHAIN LIFE, IN ONE VIEW</text>
    <image href="data:image/svg+xml;base64,${encodedLogo}" x="745" y="105" width="370" height="370"/>
  </svg>
`;

const ogImage = await sharp(Buffer.from(ogSvg))
  .png({ compressionLevel: 9 })
  .toBuffer();
await Promise.all([
  writeFile(ogImagePath, ogImage),
  writeFile(versionedOgImagePath, ogImage),
]);

console.log(
  'Generated src/app/favicon.ico and public OG image variants from public/favicon.svg',
);
