const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const dir = __dirname;
(async () => {
  const files = fs.readdirSync(dir).filter(f => /^promo-scene-\d+\.svg$/.test(f)).sort();
  for (const file of files) {
    const out = path.join(dir, file.replace('.svg', '.png'));
    await sharp(path.join(dir, file), { density: 72 }).png().toFile(out);
    console.log(out);
  }
})();
