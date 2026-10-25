#!/usr/bin/env node
/**
 * 從 Poly Haven（CC0）下載真實 PBR 掃描貼圖與室內 HDRI。
 *   node scripts/fetch-textures.mjs [--force]
 * 輸出：
 *   public/textures/<slug>/{diff,nor,rough,ao}_<1k|2k>.jpg   （nor = OpenGL 法線，three.js 直接可用）
 *   public/hdri/interior.hdr                                 （2k）
 * 已存在且 md5 相符的檔案會跳過。對應建材見 src/data/materials.json 的 `pbr` 欄位。
 * 若環境的 fetch 不走 proxy：NODE_USE_ENV_PROXY=1 node scripts/fetch-textures.mjs
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://api.polyhaven.com'
const force = process.argv.includes('--force')

/** slug → 用途。手機載入 1k；桌面 2k（見 src/lib/pbrTextures.ts） */
const TEXTURES = [
  { slug: 'laminate_floor_02', use: '全室超耐磨木地板 ED-KS81555（淺色橡木拼接）' },
  { slug: 'large_grey_tiles', use: '玄關落塵區磁磚 CW025501-25504（灰階石紋磚）' },
  { slug: 'white_oak_veneer', use: 'EGGER W1000 / ST19 深壓紋消光（僅 Normal + Roughness）', maps: ['nor_gl', 'Rough'] },
  { slug: 'grey_plaster_02', use: 'EGGER U708 / U727 ST9 柔霧面（僅 Normal + Roughness）', maps: ['nor_gl', 'Rough'] },
]
const SIZES = ['1k', '2k']
// Poly Haven map key → 本專案檔名前綴
const MAPS = { Diffuse: 'diff', nor_gl: 'nor', Rough: 'rough', AO: 'ao' }
const HDRI = { slug: 'small_empty_house', res: '2k', out: 'public/hdri/interior.hdr' }

const md5 = (buf) => createHash('md5').update(buf).digest('hex')

async function getJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}

async function download(url, dest, hash) {
  try {
    if (!force && md5(await readFile(dest)) === hash) return 'skip'
  } catch {}
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  const buf = Buffer.from(await r.arrayBuffer())
  if (hash && md5(buf) !== hash) throw new Error(`md5 mismatch ${url}`)
  await mkdir(dirname(dest), { recursive: true })
  await writeFile(dest, buf)
  return `${(buf.length / 1048576).toFixed(1)} MB`
}

for (const t of TEXTURES) {
  const files = await getJson(`${API}/files/${t.slug}`)
  for (const size of SIZES) {
    for (const [key, prefix] of Object.entries(MAPS)) {
      if (t.maps && !t.maps.includes(key)) continue
      const f = files[key]?.[size]?.jpg
      if (!f) {
        console.warn(`! ${t.slug} 沒有 ${key} ${size}`)
        continue
      }
      const dest = join(ROOT, 'public/textures', t.slug, `${prefix}_${size}.jpg`)
      console.log(`${t.slug}/${prefix}_${size}.jpg`, await download(f.url, dest, f.md5))
    }
  }
}

const hf = (await getJson(`${API}/files/${HDRI.slug}`)).hdri[HDRI.res].hdr
console.log(`hdri/${HDRI.slug}`, await download(hf.url, join(ROOT, HDRI.out), hf.md5))

// 手機用 1k HDRI
const hf1 = (await getJson(`${API}/files/${HDRI.slug}`)).hdri['1k'].hdr
console.log(`hdri/${HDRI.slug} 1k`, await download(hf1.url, join(ROOT, 'public/hdri/interior-1k.hdr'), hf1.md5))
