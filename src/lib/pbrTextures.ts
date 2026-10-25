/**
 * 真實 PBR 掃描貼圖（Poly Haven, CC0）：由 scripts/fetch-textures.mjs 下載到 public/textures/<slug>/。
 * 只在材質用到時才載入（lazy）；所有裝置相同貼圖（地板/磁磚 2k、板材微紋理 1k），不載 AO（由 N8AO 即時計算）。
 * 檔案已用 mozjpeg 風格重編碼（粗糙度只留單通道），2k 一組約 2.6 MB。
 */
import * as THREE from 'three'
import type { Archetype } from '../types'

export interface PbrSet {
  slug: string
  /** 貼圖一張涵蓋的實際公尺數（Poly Haven 標示的掃描尺寸） */
  meters: number
  /** 可用的貼圖通道。EGGER 板材只取 normal + rough，顏色維持品牌色號 */
  maps: ReadonlyArray<'albedo' | 'normal' | 'rough'>
  /** 檔案解析度 */
  size: '1k' | '2k'
}

export const PBR_SETS: Record<string, PbrSet> = {
  laminate_floor_02: { slug: 'laminate_floor_02', meters: 1.7, maps: ['albedo', 'normal', 'rough'], size: '2k' },
  large_grey_tiles: { slug: 'large_grey_tiles', meters: 3, maps: ['albedo', 'normal', 'rough'], size: '2k' },
  white_oak_veneer: { slug: 'white_oak_veneer', meters: 0.5, maps: ['normal', 'rough'], size: '1k' },
  grey_plaster_02: { slug: 'grey_plaster_02', meters: 1, maps: ['normal', 'rough'], size: '1k' },
}

/** archetype 沒有明確指定 pbr 時的預設掃描貼圖（讓既有系統櫃資料自動升級） */
export const ARCHETYPE_PBR: Partial<Record<Archetype, string>> = {
  egger_st19: 'white_oak_veneer',
  egger_st9: 'grey_plaster_02',
}

export interface LoadedPbr {
  set: PbrSet
  albedo?: THREE.Texture
  normal?: THREE.Texture
  rough?: THREE.Texture
  /** 粗糙度貼圖 G 通道平均值：用來把 spec.roughness 當成「平均粗糙度」，保留品牌/型號設定 */
  roughMean: number
}

const cache = new Map<string, Promise<LoadedPbr>>()

function loadTex(url: string, color: boolean, aniso: number) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
        t.wrapS = t.wrapT = THREE.RepeatWrapping
        t.anisotropy = aniso
        t.needsUpdate = true
        resolve(t)
      },
      undefined,
      () => reject(new Error(`failed to load ${url}`)),
    )
  })
}

function meanGreen(img: CanvasImageSource) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 32
  const g = cv.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, 32, 32)
  const d = g.getImageData(0, 0, 32, 32).data
  let s = 0
  for (let i = 1; i < d.length; i += 4) s += d[i]
  return Math.max(0.2, s / (d.length / 4) / 255)
}

export function loadPbrSet(slug: string): Promise<LoadedPbr> {
  let p = cache.get(slug)
  if (!p) {
    const set = PBR_SETS[slug]
    if (!set) return Promise.reject(new Error(`unknown pbr set ${slug}`))
    const aniso = 16 // three 會再被 GPU 上限夾住
    const url = (n: string) => `/textures/${slug}/${n}_${set.size}.jpg`
    const want = (m: PbrSet['maps'][number]) => set.maps.includes(m)
    p = (async () => {
      const [albedo, normal, rough] = await Promise.all([
        want('albedo') ? loadTex(url('diff'), true, aniso) : undefined,
        want('normal') ? loadTex(url('nor'), false, aniso) : undefined,
        want('rough') ? loadTex(url('rough'), false, aniso) : undefined,
      ])
      return { set, albedo, normal, rough, roughMean: rough ? meanGreen(rough.image as CanvasImageSource) : 1 }
    })()
    cache.set(slug, p)
    p.catch(() => cache.delete(slug))
  }
  return p
}

/** 室內 HDRI（Poly Haven small_empty_house, 1k）：只用於環境反射與微量天光，1k 已足夠 */
export const HDRI_URL = '/hdri/interior-1k.hdr'
