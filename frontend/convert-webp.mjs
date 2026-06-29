import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const imgDir = path.resolve('assets/images');

const files = fs.readdirSync(imgDir).filter(f => f.endsWith('.png'));

console.log(`Found ${files.length} PNG files to convert.`);

let totalPng = 0;
let totalWebp = 0;

for (const file of files) {
  const srcPath = path.join(imgDir, file);
  const destPath = path.join(imgDir, file.replace('.png', '.webp'));
  
  const pngSize = fs.statSync(srcPath).size;
  totalPng += pngSize;
  
  await sharp(srcPath)
    .webp({ quality: 82, effort: 4 })
    .toFile(destPath);
  
  const webpSize = fs.statSync(destPath).size;
  totalWebp += webpSize;
  
  const reduction = ((1 - webpSize / pngSize) * 100).toFixed(1);
  console.log(`${file} -> ${file.replace('.png', '.webp')}  |  ${(pngSize / 1024).toFixed(0)}KB -> ${(webpSize / 1024).toFixed(0)}KB  (-${reduction}%)`);
}

console.log(`\nTotal: ${(totalPng / 1024 / 1024).toFixed(2)}MB -> ${(totalWebp / 1024 / 1024).toFixed(2)}MB  (-${((1 - totalWebp / totalPng) * 100).toFixed(1)}%)`);
console.log('Done. You can now delete the .png files.');
