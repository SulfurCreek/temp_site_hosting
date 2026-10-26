/**
 * 真實 PBR 掃描貼圖（Poly Haven, CC0）：由 scripts/fetch-textures.mjs 下載到 public/textures/<slug>/。
 * 只在材質用到時才載入（lazy）；所有裝置相同貼圖（地板/磁磚 2k、板材微紋理 1k），不載 AO（由 N8AO 即時計算）。
 *
 * GPU 端優先用 KTX2（scripts/encode-ktx2.mjs 由同一批 JPG 轉出的 UASTC）：在 iPhone / iPad / Apple Silicon 上轉成
 * ASTC 4x4（或 BC7），一張 2k 貼圖含 mipmap 佔 5.3 MB，JPG 解壓後的 RGBA8 是 21.3 MB；畫質近乎無損（PSNR 見該腳本）。
 * 裝置不支援 ASTC / BC7 時（只剩較低畫質的 ETC2 / DXT）維持原本的 JPG，不讓畫質下降。
 */
import * as THREE from 'three'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import type { Archetype } from '../types'

export interface PbrSet {
  slug: string
  /** 貼圖一張涵蓋的實際公尺數（Poly Haven 標示的掃描尺寸） */
  meters: number
  /** 可用的貼圖通道。EGGER 板材只取 normal + rough，顏色維持品牌色號 */
  maps: ReadonlyArray<'albedo' | 'normal' | 'rough'>
  /** 檔案解析度 */
  size: '1k' | '2k'
  /** 粗糙度貼圖 G 通道平均值（encode-ktx2.mjs 由 JPG 預先算好；KTX2 沒有可讀回的影像） */
  roughMean: number
}

// 與舊版執行期算法相同（瀏覽器 canvas 縮到 32×32 取 G 平均），數值逐位相同
const RM_LAMINATE = 0.3682061887254902
const RM_TILES = 0.8058019301470588
const RM_OAK = 0.7260952818627451
const RM_PLASTER = 0.7920802696078432

export const PBR_SETS: Record<string, PbrSet> = {
  laminate_floor_02: { slug: 'laminate_floor_02', meters: 1.7, maps: ['albedo', 'normal', 'rough'], size: '2k', roughMean: RM_LAMINATE },
  large_grey_tiles: { slug: 'large_grey_tiles', meters: 3, maps: ['albedo', 'normal', 'rough'], size: '2k', roughMean: RM_TILES },
  white_oak_veneer: { slug: 'white_oak_veneer', meters: 0.5, maps: ['normal', 'rough'], size: '1k', roughMean: RM_OAK },
  grey_plaster_02: { slug: 'grey_plaster_02', meters: 1, maps: ['normal', 'rough'], size: '1k', roughMean: RM_PLASTER },
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

function setup(t: THREE.Texture, color: boolean, aniso: number) {
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.anisotropy = aniso
  return t
}

function loadJpg(url: string, color: boolean, aniso: number) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.generateMipmaps = true
        setup(t, color, aniso)
        t.needsUpdate = true
        resolve(t)
      },
      undefined,
      () => reject(new Error(`failed to load ${url}`)),
    )
  })
}

/* ---------- KTX2 ---------- */
let ktx2: KTX2Loader | null | undefined
let rendererReady: (gl: THREE.WebGLRenderer) => void
const rendererP = new Promise<THREE.WebGLRenderer>((r) => (rendererReady = r))

/** Canvas 建立後呼叫一次：KTX2Loader 需要知道 GPU 支援哪些壓縮格式 */
export function initTextureCompression(gl: THREE.WebGLRenderer) {
  rendererReady(gl)
}

async function getKtx2(): Promise<KTX2Loader | null> {
  if (ktx2 !== undefined) return ktx2
  const gl = await rendererP
  if (ktx2 !== undefined) return ktx2
  // 只接受高畫質的轉碼目標（ASTC 4x4 / BC7）；其他格式畫質較差，改用原本的 JPG
  const hq = gl.extensions.has('WEBGL_compressed_texture_astc') || gl.extensions.has('EXT_texture_compression_bptc')
  if (!hq || /[?&]ktx2=0/.test(location.search)) return (ktx2 = null)
  ktx2 = new KTX2Loader().setTranscoderPath('/basis/').setWorkerLimit(2).detectSupport(gl)
  return ktx2
}

async function loadTex(dir: string, name: string, color: boolean, aniso: number): Promise<THREE.Texture> {
  const loader = await getKtx2()
  if (loader) {
    try {
      const t = await loader.loadAsync(`${dir}/${name}.ktx2`)
      return setup(t, color, aniso)
    } catch (e) {
      console.warn('[ktx2] fallback to jpg', name, (e as Error).message)
    }
  }
  return loadJpg(`${dir}/${name}.jpg`, color, aniso)
}

export function loadPbrSet(slug: string): Promise<LoadedPbr> {
  let p = cache.get(slug)
  if (!p) {
    const set = PBR_SETS[slug]
    if (!set) return Promise.reject(new Error(`unknown pbr set ${slug}`))
    const aniso = 16 // three 會再被 GPU 上限夾住
    const dir = `/textures/${slug}`
    const want = (m: PbrSet['maps'][number]) => set.maps.includes(m)
    p = (async () => {
      const [albedo, normal, rough] = await Promise.all([
        want('albedo') ? loadTex(dir, `diff_${set.size}`, true, aniso) : undefined,
        want('normal') ? loadTex(dir, `nor_${set.size}`, false, aniso) : undefined,
        want('rough') ? loadTex(dir, `rough_${set.size}`, false, aniso) : undefined,
      ])
      return { set, albedo, normal, rough, roughMean: rough ? set.roughMean : 1 }
    })()
    cache.set(slug, p)
    p.catch(() => cache.delete(slug))
  }
  return p
}

/** 室內 HDRI（Poly Haven small_empty_house, 1k）：只用於環境反射與微量天光，1k 已足夠 */
export const HDRI_URL = '/hdri/interior-1k.hdr'
