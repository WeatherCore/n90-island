// 一次性脚本：public/assets/textures/*.jpg → *.webp（视觉无损，quality 92）
// 用法：npm run optimize:textures
import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../public/assets/textures");
const files = readdirSync(dir).filter((f) => f.endsWith(".jpg"));
let before = 0;
let after = 0;
for (const file of files) {
  const src = join(dir, file);
  const dst = join(dir, file.replace(/\.jpg$/, ".webp"));
  const input = statSync(src).size;
  await sharp(src).webp({ quality: 92 }).toFile(dst);
  const output = statSync(dst).size;
  before += input;
  after += output;
  console.log(`${file}: ${(input / 1024).toFixed(0)}KB -> ${(output / 1024).toFixed(0)}KB`);
}
console.log(`\ntotal: ${(before / 1048576).toFixed(2)}MB -> ${(after / 1048576).toFixed(2)}MB`);
