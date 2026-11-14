/**
 * 把 public/textures/<slug>/*.jpg 轉成 KTX2（UASTC + Zstd + 預先產生的 mipmap）。
 * GPU 端直接以 ASTC 4x4 / BC7 / ETC2 壓縮格式存放（每像素 1 byte，JPEG 解壓後是 4 byte），畫質近乎無損。
 * 用法：node scripts/encode-ktx2.mjs [--force]   （預設跳過比 JPG 新的 .ktx2；2k 一張約 1–2 分鐘）
 * 品質檢查：node scripts/check-ktx2.mjs
 */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { encodeToKTX2 } from 'ktx2-encoder'

const ROOT = new URL('../public/textures/', import.meta.url).pathname

const imageDecoder = async (buf) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data: new Uint8Array(data), width: info.width, height: info.height }
}

for (const slug of await readdir(ROOT)) {
  for (const f of await readdir(join(ROOT, slug))) {
    if (!f.endsWith('.jpg')) continue
    const kind = f.split('_')[0] // diff | nor | rough
    const name = f.replace(/\.jpg$/, '.ktx2')
    const ktxStat = await stat(join(ROOT, slug, name)).catch(() => null)
    if (ktxStat && !process.argv.includes('--force') && ktxStat.mtimeMs > (await stat(join(ROOT, slug, f))).mtimeMs) continue
    const src = await readFile(join(ROOT, slug, f))
    const t = performance.now()
    const out = await encodeToKTX2(new Uint8Array(src), {
      isUASTC: true,
      uastcLDRQualityLevel: 3,
      enableRDO: false,
      needSupercompression: true,
      generateMipmap: true,
      // TextureLoader 預設 flipY；壓縮貼圖不能在上傳時翻轉，所以編碼時先翻
      isYFlip: true,
      isPerceptual: kind === 'diff',
      isSetKTX2SRGBTransferFunc: kind === 'diff',
      isNormalMap: kind === 'nor',
      imageDecoder,
    })
    await writeFile(join(ROOT, slug, name), out)
    const { width } = await sharp(src).metadata()
    console.log(`${slug}/${name}  ${width}px  jpg ${(src.length / 1024).toFixed(0)} KB → ktx2 ${(out.length / 1024).toFixed(0)} KB  ${((performance.now() - t) / 1000).toFixed(1)}s`)
  }
}
