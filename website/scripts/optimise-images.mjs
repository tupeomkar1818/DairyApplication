#!/usr/bin/env node
/**
 * Makes the site's two pictures small enough for a phone on mobile data.
 *
 * The logo was shipped at 900×900 and 369 KB to be shown at 48 pixels in the header; the banner at 82 KB. Between
 * them that was most of what the page weighed, and this is a page for customers in Kothrud opening it on a phone.
 *
 * Run it after replacing either source picture in `assets/`:
 *
 *   npm run images
 *
 * It writes `public/images/` — a WebP for browsers that take one (almost all of them) and a smaller PNG beside it
 * for the few that do not. The pages ask for them with <picture>, so nobody is left looking at a gap.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/images');

/** The largest each one is ever shown at, doubled, so it stays sharp on a dense screen. */
const WORK = [
  { from: 'assets/amrale-logo.png', name: 'amrale-logo', width: 640 },
  { from: 'assets/amrale-products-banner.png', name: 'amrale-products-banner', width: 1024 },
];

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

await mkdir(OUT, { recursive: true });

for (const { from, name, width } of WORK) {
  const source = await readFile(resolve(ROOT, from));
  const before = source.length;

  const squeezed = await sharp(source).resize({ width, withoutEnlargement: true }).png({ compressionLevel: 9, palette: true }).toBuffer();
  const webp = await sharp(source).resize({ width, withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();

  // Paletting is a huge win on a flat logo and a loss on a photograph, so keep whichever came out smaller. Shipping
  // a file bigger than the one we started with would be a strange way to make a page lighter.
  const png = squeezed.length < before ? squeezed : source;

  await writeFile(resolve(OUT, `${name}.png`), png);
  await writeFile(resolve(OUT, `${name}.webp`), webp);

  console.log(`${name}: ${kb(before)} → ${kb(webp.length)} webp, ${kb(png.length)} png${png === source ? ' (kept as it was)' : ''}`);
}
