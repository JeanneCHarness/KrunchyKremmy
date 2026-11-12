import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const outputRoot = path.join(publicRoot, "optimized");
const manifestPath = fileURLToPath(new URL("../src/image-manifest.json", import.meta.url));
const targetWidths = [480, 960, 1440];
const sourceDirectories = ["ice-cream", "images", "krunchy"];
const webpOptions = { quality: 84, effort: 5 };

async function findImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findImages(fullPath));
    else if (/\.(?:png|jpe?g)$/i.test(entry.name)) files.push(fullPath);
  }
  return files;
}

await mkdir(outputRoot, { recursive: true });
const sources = (await Promise.all(sourceDirectories.map((directory) => findImages(path.join(publicRoot, directory))))).flat();
const manifest = {};
let originalBytes = 0;
let optimizedBytes = 0;

for (const sourcePath of sources) {
  const sourceBytes = await readFile(sourcePath);
  const metadata = await sharp(sourceBytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error(`Image dimensions are missing: ${sourcePath}`);

  const rotated = [5, 6, 7, 8].includes(metadata.orientation);
  const width = rotated ? metadata.height : metadata.width;
  const height = rotated ? metadata.width : metadata.height;
  const widths = targetWidths.filter((targetWidth) => targetWidth < width);
  if (!widths.includes(width)) widths.push(width);
  widths.sort((left, right) => left - right);

  const sourceRelativePath = `/${path.relative(publicRoot, sourcePath).split(path.sep).join("/")}`;
  const assetHash = createHash("sha256")
    .update(sourceBytes)
    .update(`webp:${webpOptions.quality}:${webpOptions.effort}`)
    .digest("hex")
    .slice(0, 16);
  const variants = [];

  for (const targetWidth of widths) {
    const filename = `${assetHash}-${targetWidth}.webp`;
    const outputPath = path.join(outputRoot, filename);
    await sharp(sourceBytes)
      .rotate()
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp(webpOptions)
      .toFile(outputPath);
    const outputStat = await stat(outputPath);
    optimizedBytes += outputStat.size;
    variants.push({ width: targetWidth, src: `/optimized/${filename}` });
  }

  originalBytes += sourceBytes.byteLength;
  manifest[sourceRelativePath] = { width, height, variants };
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const savings = originalBytes ? Math.round((1 - optimizedBytes / originalBytes) * 100) : 0;
console.log(`Optimized ${sources.length} photos: ${(originalBytes / 1024 / 1024).toFixed(2)} MB originals; ${(optimizedBytes / 1024 / 1024).toFixed(2)} MB across responsive WebP variants (${savings}% fewer bytes in aggregate).`);
