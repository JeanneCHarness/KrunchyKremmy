import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
const manifestPath = fileURLToPath(new URL("../src/image-manifest.json", import.meta.url));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

async function findPhotoPaths(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await findPhotoPaths(fullPath));
    else if (/\.(?:png|jpe?g)$/i.test(entry.name)) {
      paths.push(`/${path.relative(publicRoot, fullPath).split(path.sep).join("/")}`);
    }
  }
  return paths;
}

test("responsive image manifest points to every original and non-upscaled WebP variant", async () => {
  const sourcePaths = (await Promise.all(
    ["ice-cream", "images", "krunchy"].map((directory) => findPhotoPaths(path.join(publicRoot, directory)))
  )).flat().sort();
  assert.deepEqual(Object.keys(manifest).sort(), sourcePaths);

  for (const [source, image] of Object.entries(manifest)) {
    assert.ok(image.width > 0 && image.height > 0, `${source} has intrinsic dimensions`);
    assert.ok(image.variants.length > 0, `${source} has responsive variants`);
    await access(path.join(publicRoot, decodeURIComponent(source.slice(1))));
    assert.equal(Math.max(...image.variants.map((variant) => variant.width)), image.width, `${source} includes its native-size variant`);

    for (const variant of image.variants) {
      assert.ok(variant.width <= image.width, `${variant.src} does not upscale its source`);
      assert.match(variant.src, /^\/optimized\/[a-f0-9]{16}-\d+\.webp$/);
      await access(path.join(publicRoot, variant.src.slice(1)));
    }
  }
});
