/**
 * 內建程序化貼圖（不需外部檔案，離線可用）。
 * 以 `builtin:<name>` 作為 MaterialSpec.map。每張貼圖涵蓋 1 m × 1 m。
 */

export const BUILTIN_TEXTURES = [
  { id: 'builtin:oak', label: '橡木地板' },
  { id: 'builtin:oak-light', label: '淺橡木' },
  { id: 'builtin:oak-ash', label: '灰褐橡木（實景）' },
  { id: 'builtin:walnut', label: '胡桃木' },
  { id: 'builtin:tile', label: '白色方磚' },
  { id: 'builtin:tile-gray', label: '灰階地磚' },
  { id: 'builtin:tile-dark', label: '深灰磁磚' },
  { id: 'builtin:concrete', label: '清水模' },
  { id: 'builtin:fabric', label: '織布' },
  { id: 'builtin:marble', label: '大理石' },
  { id: 'builtin:encaustic', label: '八角花磚' },
] as const

/** 可重現的偽亂數，讓每次生成的貼圖一致 */
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

const SIZE = 512

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`
}

function wood(base: string, planks: number, seed: number) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = SIZE
  const g = cv.getContext('2d')!
  const r = rng(seed)
  const ph = SIZE / planks
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph
    // 每片板材隨機錯位的接縫，且 u 方向需可無縫重複
    const joint = r() * SIZE
    for (const [x0, x1] of [
      [0, joint],
      [joint, SIZE],
    ] as const) {
      g.fillStyle = shade(base, 0.88 + r() * 0.22)
      g.fillRect(x0, y0, x1 - x0, ph)
      // 木紋
      for (let i = 0; i < 26; i++) {
        const yy = y0 + r() * ph
        const amp = 0.6 + r() * 2.2
        const ph0 = r() * 6
        g.strokeStyle = `rgba(60,35,15,${0.04 + r() * 0.09})`
        g.lineWidth = 0.6 + r() * 1.4
        g.beginPath()
        for (let x = x0; x <= x1; x += 8) {
          const y = yy + Math.sin(x * 0.02 + ph0) * amp
          if (x === x0) g.moveTo(x, y)
          else g.lineTo(x, y)
        }
        g.stroke()
      }
      g.fillStyle = 'rgba(30,15,5,0.45)'
      g.fillRect(x0, y0, 1.5, ph)
    }
    g.fillStyle = 'rgba(30,15,5,0.5)'
    g.fillRect(0, y0, SIZE, 1.5)
  }
  return cv
}

function tile() {
  const cv = document.createElement('canvas')
  cv.width = cv.height = SIZE
  const g = cv.getContext('2d')!
  const n = 2 // 每公尺 2×2 → 50 cm 方磚
  const s = SIZE / n
  const r = rng(7)
  g.fillStyle = '#b9b9b4'
  g.fillRect(0, 0, SIZE, SIZE)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      g.fillStyle = shade('#f1f0ec', 0.96 + r() * 0.06)
      g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6)
    }
  return cv
}

function tileGray(grout = '#8f8f8c', base = '#b4b4b0', _edge = '') {
  const cv = document.createElement('canvas')
  cv.width = cv.height = SIZE
  const g = cv.getContext('2d')!
  const r = rng(17)
  const n = 2
  const s = SIZE / n
  g.fillStyle = grout
  g.fillRect(0, 0, SIZE, SIZE)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      g.fillStyle = shade(base, 0.94 + r() * 0.1)
      g.fillRect(i * s + 3, j * s + 3, s - 6, s - 6)
      for (let k = 0; k < 400; k++) {
        g.fillStyle = `rgba(${r() > 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.06})`
        g.fillRect(i * s + r() * s, j * s + r() * s, 2, 2)
      }
    }
  return cv
}

function noise(base: string, seed: number, grain: number, blotch: number) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = SIZE
  const g = cv.getContext('2d')!
  const r = rng(seed)
  g.fillStyle = base
  g.fillRect(0, 0, SIZE, SIZE)
  for (let i = 0; i < blotch; i++) {
    const x = r() * SIZE
    const y = r() * SIZE
    const rad = 20 + r() * 80
    const gr = g.createRadialGradient(x, y, 0, x, y, rad)
    const d = r() > 0.5 ? '0,0,0' : '255,255,255'
    gr.addColorStop(0, `rgba(${d},${0.05 + r() * 0.06})`)
    gr.addColorStop(1, `rgba(${d},0)`)
    g.fillStyle = gr
    for (const ox of [-SIZE, 0, SIZE])
      for (const oy of [-SIZE, 0, SIZE]) {
        g.save()
        g.translate(ox, oy)
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2)
        g.restore()
      }
  }
  for (let i = 0; i < grain; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.08})`
    g.fillRect(r() * SIZE, r() * SIZE, 1 + r() * 2, 1 + r() * 2)
  }
  return cv
}

function fabric() {
  const cv = noise('#e6e6e6', 11, 6000, 0)
  const g = cv.getContext('2d')!
  g.globalAlpha = 0.18
  for (let i = 0; i < SIZE; i += 4) {
    g.fillStyle = i % 8 === 0 ? '#000' : '#fff'
    g.fillRect(i, 0, 2, SIZE)
    g.fillRect(0, i, SIZE, 2)
  }
  g.globalAlpha = 1
  return cv
}

function marble() {
  const cv = noise('#eeeeea', 21, 800, 30)
  const g = cv.getContext('2d')!
  const r = rng(5)
  for (let k = 0; k < 7; k++) {
    g.strokeStyle = `rgba(90,95,105,${0.15 + r() * 0.25})`
    g.lineWidth = 0.6 + r() * 1.8
    g.beginPath()
    let x = r() * SIZE
    let y = 0
    g.moveTo(x, y)
    while (y < SIZE) {
      x += (r() - 0.5) * 40
      y += 12 + r() * 20
      g.lineTo(x, y)
    }
    g.stroke()
  }
  return cv
}

/** 米白八角花磚 + 橘紅小方塊（玄關參考照右版）。每 50 cm 一格，1 m 內 2×2 */
function encaustic() {
  const cv = document.createElement('canvas')
  cv.width = cv.height = SIZE
  const g = cv.getContext('2d')!
  const n = 2
  const s = SIZE / n
  g.fillStyle = '#ece6d8'
  g.fillRect(0, 0, SIZE, SIZE)
  // 八角形輪廓線
  g.strokeStyle = '#cfc7b4'
  g.lineWidth = 2.5
  const c = s * 0.29
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x = i * s
      const y = j * s
      g.beginPath()
      g.moveTo(x + c, y)
      g.lineTo(x + s - c, y)
      g.lineTo(x + s, y + c)
      g.lineTo(x + s, y + s - c)
      g.lineTo(x + s - c, y + s)
      g.lineTo(x + c, y + s)
      g.lineTo(x, y + s - c)
      g.lineTo(x, y + c)
      g.closePath()
      g.stroke()
    }
  // 橘紅小方塊：格心（正）與格角（菱形，跨磚拼合）
  g.fillStyle = '#c4532f'
  const q = s * 0.1
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      g.fillRect(i * s + s / 2 - q, j * s + s / 2 - q, q * 2, q * 2)
      for (const [ox, oy] of [[0, 0], [s, 0], [0, s], [s, s]] as const) {
        g.save()
        g.translate((i * s + ox + SIZE) % SIZE, (j * s + oy + SIZE) % SIZE)
        g.rotate(Math.PI / 4)
        g.fillRect(-q * 0.7, -q * 0.7, q * 1.4, q * 1.4)
        g.restore()
      }
    }
  return cv
}

const makers: Record<string, () => HTMLCanvasElement> = {
  'builtin:oak': () => wood('#c9a171', 5, 3),
  'builtin:oak-light': () => wood('#dcc8a6', 5, 5),
  'builtin:walnut': () => wood('#6b4a33', 4, 9),
  'builtin:oak-ash': () => wood('#bdb8ac', 5, 7),
  'builtin:tile-gray': () => tileGray(),
  'builtin:tile-dark': () => tileGray('#5f666b', '#79828a', '#454b4f'),
  'builtin:tile': tile,
  'builtin:concrete': () => noise('#b4b4b0', 13, 9000, 60),
  'builtin:fabric': fabric,
  'builtin:marble': marble,
  'builtin:encaustic': encaustic,
}

const cache = new Map<string, HTMLCanvasElement>()

/** 取得內建貼圖的 canvas（含快取）。找不到名稱時回傳 null。 */
export function getBuiltinCanvas(id: string): HTMLCanvasElement | null {
  if (cache.has(id)) return cache.get(id)!
  const make = makers[id]
  if (!make) return null
  const cv = make()
  cache.set(id, cv)
  return cv
}
