/**
 * 檢查 KTX2 與原 JPG 的差異：用 three.js 附的 Basis 轉碼器把 UASTC 解成 RGBA，與 JPG 解碼結果逐像素比較（第 0 層）。
 * 用法：node scripts/check-ktx2.mjs
 */
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import sharp from 'sharp'

const require = createRequire(import.meta.url)
const ROOT = new URL('../public/textures/', import.meta.url).pathname
// 轉碼器是 UMD 腳本，但 three 套件是 ESM（type: module），不能直接 require
const mod = { exports: {} }
const tjs = require.resolve('three/examples/jsm/libs/basis/basis_transcoder.js')
new Function('module', 'exports', 'require', '__filename', '__dirname', await readFile(tjs, 'utf8'))(mod, mod.exports, require, tjs, dirname(tjs))
const BASIS = mod.exports
const wasmBinary = await readFile(require.resolve('three/examples/jsm/libs/basis/basis_transcoder.wasm'))
const M = await BASIS({ wasmBinary })
M.initializeBasis()
const RGBA32 = 13

for (const slug of await readdir(ROOT)) {
  for (const f of await readdir(join(ROOT, slug))) {
    if (!f.endsWith('.ktx2')) continue
    const kind = f.split('_')[0]
    const file = new M.KTX2File(new Uint8Array(await readFile(join(ROOT, slug, f))))
    file.startTranscoding()
    const w = file.getWidth(), h = file.getHeight(), levels = file.getLevels()
    const dst = new Uint8Array(file.getImageTranscodedSizeInBytes(0, 0, 0, RGBA32))
    file.transcodeImage(dst, 0, 0, 0, RGBA32, 0, -1, -1)
    file.close(); file.delete()
    const jpg = await readFile(join(ROOT, slug, f.replace('.ktx2', '.jpg')))
    const { data } = await sharp(jpg).flip().ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const ch = kind === 'rough' ? [1] : kind === 'nor' ? [0, 1, 2] : [0, 1, 2]
    let se = 0, n = 0, max = 0
    for (let i = 0; i < w * h; i++)
      for (const c of ch) {
        const d = dst[i * 4 + c] - data[i * 4 + c]
        se += d * d; n++
        if (Math.abs(d) > max) max = Math.abs(d)
      }
    const psnr = 10 * Math.log10((255 * 255) / (se / n))
    console.log(`${slug}/${f}  ${w}x${h} L${levels}  PSNR ${psnr.toFixed(1)} dB  maxΔ ${max}`)
  }
}
