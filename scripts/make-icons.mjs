// Regenerates the PWA / Windows app icons from public/icons/icon.svg.
// Usage: node scripts/make-icons.mjs
import sharp from "sharp";

const src = "public/icons/icon.svg";
for (const size of [192, 512]) {
  await sharp(src).resize(size, size).png().toFile(`public/icons/icon-${size}.png`);
}
// Maskable: full-bleed background with the artwork inside the 80% safe zone.
const art = await sharp(src).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#7b4cff" } })
  .composite([{ input: art, top: 56, left: 56 }])
  .png()
  .toFile("public/icons/maskable-512.png");
await sharp(src).resize(180, 180).flatten({ background: "#7b4cff" }).png().toFile("public/icons/apple-touch-icon.png");
console.log("icons written");
