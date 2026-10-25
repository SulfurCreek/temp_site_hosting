// 貼圖壓縮：node scripts/optimize-textures.mjs [--max 1024] [--dry]
// 掃描 public/textures/<slug>/*.jpg：
//   - 邊長超過上限就縮小（預設 1024；KEEP 內的地板 / 磁磚為地面近看的主貼圖，維持 2048 以免近距離變糊）
//   - rough_* 只保留單通道（著色器只讀 G）
//   - 以 mozjpeg 重新編碼（progressive、quality 86）；只有變小才覆寫
// 注意：JPEG 每次重新編碼都有微小損失；目前 repo 內的貼圖已是瘦身後版本，只在新增 / 更換貼圖時執行，先用 --dry 看結果。
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = new URL('../public/textures/', import.meta.url).pathname
const args = process.argv.slice(2)
const MAX = Number(args[args.indexOf('--max') + 1]) || 1024
const DRY = args.includes('--dry')
/** 這些貼圖組維持較高解析度（見 src/lib/pbrTextures.ts 的 size: '2k'）；要全部壓到 1024 請把這個集合清空 */
const KEEP = new Map([
  ['laminate_floor_02', 2048],
  ['large_grey_tiles', 2048],
])

let before = 0
let after = 0
for (const slug of fs.readdirSync(ROOT)) {
  const dir = path.join(ROOT, slug)
  if (!fs.statSync(dir).isDirectory()) continue
  const cap = KEEP.get(slug) ?? MAX
  for (const f of fs.readdirSync(dir).filter((x) => /\.jpe?g$/i.test(x))) {
    const file = path.join(dir, f)
    const src = fs.readFileSync(file)
    let img = sharp(src)
    const { width = 0, height = 0 } = await img.metadata()
    if (Math.max(width, height) > cap) img = img.resize({ width: cap, height: cap, fit: 'inside', kernel: 'lanczos3' })
    if (f.startsWith('rough_')) img = img.greyscale()
    const out = await img.jpeg({ quality: 86, progressive: true, mozjpeg: true, chromaSubsampling: f.startsWith('nor_') ? '4:4:4' : '4:2:0' }).toBuffer()
    before += src.length
    const keep = out.length < src.length
    after += keep ? out.length : src.length
    console.log(`${slug}/${f} ${width}x${height} ${(src.length / 1024) | 0}KB -> ${keep ? (out.length / 1024) | 0 : '(unchanged)'}KB`)
    if (keep && !DRY) fs.writeFileSync(file, out)
  }
}
console.log(`total ${(before / 1048576).toFixed(2)}MB -> ${(after / 1048576).toFixed(2)}MB${DRY ? ' (dry run)' : ''}`)
