/**
 * 程序化微紋理生成器：用 Canvas 產生 Normal Map 與 Roughness Map，不依賴外部圖檔。
 * paint / st9 / st19 為獨立可平鋪的微紋理；laminate_wood / matte_tile 由 albedo 貼圖的
 * 亮度導出高度場（拼縫、填縫自然變成凹槽），與 albedo 同比例對位。
 */
import type { Archetype } from '../types'

const N = 256

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 可平鋪的 3x3 box blur */
function blur(h: Float32Array, n: number, passes = 1) {
  let a = h
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(n * n)
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        let s = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) s += a[((y + dy + n) % n) * n + ((x + dx + n) % n)]
        b[y * n + x] = s / 9
      }
    a = b
  }
  return a
}

function normalize01(h: Float32Array) {
  let lo = Infinity
  let hi = -Infinity
  for (const v of h) {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  const k = hi > lo ? 1 / (hi - lo) : 1
  for (let i = 0; i < h.length; i++) h[i] = (h[i] - lo) * k
}

/** 高度場 (0..1) → 切線空間法線貼圖 canvas */
function heightToNormal(h: Float32Array, n: number, strength: number) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = n
  const g = cv.getContext('2d')!
  const img = g.createImageData(n, n)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const l = h[y * n + ((x - 1 + n) % n)]
      const r = h[y * n + ((x + 1) % n)]
      const u = h[((y - 1 + n) % n) * n + x]
      const d = h[((y + 1) % n) * n + x]
      const nx = -(r - l) * strength
      const ny = (d - u) * strength
      const inv = 1 / Math.hypot(nx, ny, 1)
      const i = (y * n + x) * 4
      img.data[i] = (nx * inv * 0.5 + 0.5) * 255
      img.data[i + 1] = (ny * inv * 0.5 + 0.5) * 255
      img.data[i + 2] = (inv * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  g.putImageData(img, 0, 0)
  return cv
}

/**
 * 粗糙度貼圖（G 通道）：作為倍率乘上 material.roughness。平均值約 0.9，
 * 材質端會用 1/ROUGH_MEAN 補償，所以整體粗糙度仍是 spec 值。
 */
export const ROUGH_MEAN = 0.9

function heightToRoughness(h: Float32Array, n: number, spread: number, invert = false) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = n
  const g = cv.getContext('2d')!
  const img = g.createImageData(n, n)
  for (let i = 0; i < n * n; i++) {
    const v = invert ? 1 - h[i] : h[i]
    const c = Math.max(0, Math.min(1, ROUGH_MEAN + (v - 0.5) * spread)) * 255
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = c
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  return cv
}

export interface MicroMaps {
  normal: HTMLCanvasElement
  rough: HTMLCanvasElement
}

function paintHeight(): Float32Array {
  // 滾筒塗裝：細顆粒 + 少量較大的橘皮起伏
  const r = rng(11)
  const fine = new Float32Array(N * N)
  for (let i = 0; i < fine.length; i++) fine[i] = r()
  const coarse = new Float32Array(N * N)
  for (let i = 0; i < coarse.length; i++) coarse[i] = r()
  const c = blur(coarse, N, 4)
  normalize01(c)
  const f = blur(fine, N, 1)
  normalize01(f)
  const h = new Float32Array(N * N)
  for (let i = 0; i < h.length; i++) h[i] = f[i] * 0.65 + c[i] * 0.35
  return h
}

function st9Height(): Float32Array {
  // 柔霧：極細的等向顆粒
  const r = rng(23)
  const h = new Float32Array(N * N)
  for (let i = 0; i < h.length; i++) h[i] = r()
  const b = blur(h, N, 2)
  normalize01(b)
  return b
}

function st19Height(): Float32Array {
  // 直向木紋壓痕：沿 Y 拉長的短筆劃 + 欄位級隨機，形成細長導管孔
  const r = rng(37)
  const h = new Float32Array(N * N)
  const col = new Float32Array(N)
  for (let x = 0; x < N; x++) col[x] = r()
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) h[y * N + x] = 0.5 + (col[x] - 0.5) * 0.25
  for (let k = 0; k < 2600; k++) {
    const x = Math.floor(r() * N)
    const y0 = Math.floor(r() * N)
    const len = 6 + Math.floor(r() * 38)
    const depth = 0.25 + r() * 0.5
    for (let j = 0; j < len; j++) {
      const t = j / len
      const taper = Math.sin(t * Math.PI)
      const idx = ((y0 + j) % N) * N + x
      h[idx] -= depth * taper
    }
  }
  // 只沿 X 輕微模糊，保留直向條紋
  const out = new Float32Array(N * N)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++)
      out[y * N + x] = (h[y * N + ((x - 1 + N) % N)] + 2 * h[y * N + x] + h[y * N + ((x + 1) % N)]) / 4
  normalize01(out)
  return out
}

function scratchFabricHeight(): Float32Array {
  // 貓抓布：高密度斜紋（2/1 twill），經緯紗起伏 + 細微絨毛雜訊；256px 涵蓋 8×8 組紗線，可無縫平鋪
  const r = rng(53)
  const cell = 8
  const h = new Float32Array(N * N)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const cx = Math.floor(x / cell)
      const cy = Math.floor(y / cell)
      const u = (x % cell) / cell
      const v = (y % cell) / cell
      const over = (cx + cy) % 3 !== 0 // 斜紋：經紗浮在 2/3 的位置
      const warp = Math.sin(u * Math.PI)
      const weft = Math.sin(v * Math.PI)
      h[y * N + x] = over ? 0.55 + 0.45 * warp * (0.6 + 0.4 * weft) : 0.25 + 0.3 * weft * (0.6 + 0.4 * warp)
    }
  const fuzz = new Float32Array(N * N)
  for (let i = 0; i < fuzz.length; i++) fuzz[i] = r()
  const f = blur(fuzz, N, 1)
  normalize01(f)
  for (let i = 0; i < h.length; i++) h[i] = h[i] * 0.8 + f[i] * 0.2
  normalize01(h)
  return h
}

const cache = new Map<string, MicroMaps>()

/** 獨立平鋪的微紋理（paint / st9 / st19） */
export function getStandaloneMicro(a: 'paint_eggshell' | 'egger_st9' | 'egger_st19' | 'fabric_scratch'): MicroMaps {
  const hit = cache.get(a)
  if (hit) return hit
  const h =
    a === 'paint_eggshell' ? paintHeight() : a === 'egger_st9' ? st9Height() : a === 'fabric_scratch' ? scratchFabricHeight() : st19Height()
  const strength = a === 'egger_st19' ? 5 : a === 'egger_st9' ? 2.2 : a === 'fabric_scratch' ? 4 : 3
  const maps = {
    normal: heightToNormal(h, N, strength),
    rough: heightToRoughness(h, N, a === 'egger_st19' ? 0.35 : a === 'fabric_scratch' ? 0.3 : 0.25),
  }
  cache.set(a, maps)
  return maps
}

/** 由 albedo 圖導出（laminate_wood / matte_tile）。key 用於快取。 */
export function getDerivedMicro(a: Archetype, key: string, src: CanvasImageSource): MicroMaps | null {
  const ck = a + '|' + key
  const hit = cache.get(ck)
  if (hit) return hit
  const n = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = n
  const g = cv.getContext('2d', { willReadFrequently: true })!
  try {
    g.drawImage(src, 0, 0, n, n)
  } catch {
    return null
  }
  let data: Uint8ClampedArray
  try {
    data = g.getImageData(0, 0, n, n).data
  } catch {
    return null // 跨來源圖片被污染，退回無微紋理
  }
  const h = new Float32Array(n * n)
  const r = rng(53)
  for (let i = 0; i < h.length; i++) {
    const lum = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255
    // 微顆粒：木為順紋細噪，磚為石材微粒
    h[i] = lum + (r() - 0.5) * (a === 'matte_tile' ? 0.12 : 0.05)
  }
  const sm = blur(h, n, a === 'laminate_wood' ? 1 : 1)
  normalize01(sm)
  const maps = { normal: heightToNormal(sm, n, a === 'matte_tile' ? 6 : 4), rough: heightToRoughness(sm, n, 0.3) }
  cache.set(ck, maps)
  return maps
}
