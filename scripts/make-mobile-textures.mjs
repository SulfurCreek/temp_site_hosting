// 行動端用 1k 版貼圖：node scripts/make-mobile-textures.mjs
// 把 public/textures/<slug>/*_2k.jpg 縮成 *_1k.jpg（lanczos3、與 optimize-textures.mjs 相同的編碼設定）。
// 之後執行 node scripts/encode-ktx2.mjs 會順便把新的 *_1k.jpg 轉成 *_1k.ktx2。已是 1k 的貼圖組不處理。
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = new URL('../public/textures/', import.meta.url).pathname
for (const slug of fs.readdirSync(ROOT)) {
  const dir = path.join(ROOT, slug)
  if (!fs.statSync(dir).isDirectory()) continue
  for (const f of fs.readdirSync(dir).filter((x) => /_2k\.jpe?g$/i.test(x))) {
    const out = path.join(dir, f.replace('_2k', '_1k'))
    let img = sharp(path.join(dir, f)).resize({ width: 1024, height: 1024, fit: 'inside', kernel: 'lanczos3' })
    if (f.startsWith('rough_')) img = img.greyscale()
    const buf = await img.jpeg({ quality: 88, progressive: true, mozjpeg: true, chromaSubsampling: f.startsWith('nor_') ? '4:4:4' : '4:2:0' }).toBuffer()
    fs.writeFileSync(out, buf)
    console.log(`${slug}/${path.basename(out)} ${(buf.length / 1024) | 0} KB`)
  }
}
