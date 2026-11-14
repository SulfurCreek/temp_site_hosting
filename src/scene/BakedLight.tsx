import { useMemo } from 'react'
import * as THREE from 'three'
import { MEP_ITEMS } from '../data'
import type { MepItem, Wall } from '../types'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import { TRACK_AIM } from './Fixtures'

/**
 * 行動端「視覺欺騙光影術」：不放任何 SpotLight / PointLight，
 * - 燈具的光斑 = 貼在牆面 / 地板上的半透明加色漸層貼片（同一張 128² 貼圖、同一份材質，2 個三角形一片）
 * - 家具與牆角的接觸陰影 = 同一張 128² 柔邊貼圖的軟陰影墊片（家具底部）與 15 cm 暗角帶（牆腳 / 牆頂）
 * 全部是 depthWrite=false 的 MeshBasicMaterial，零光照運算；位置只在資料變動時重算，旋轉鏡頭時 0 成本。
 */

/* ------------------------------ 共用貼圖 ------------------------------ */

function canvasTex(size: number, paint: (px: (x: number, y: number) => number, set: (i: number, v: number) => void) => void, color: boolean) {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const set = (i: number, v: number) => {
    const b = Math.max(0, Math.min(255, Math.round(v * 255)))
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = color ? 255 : b
    img.data[i * 4 + 3] = color ? b : 255
  }
  paint(() => 0, set)
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.NoColorSpace
  t.generateMipmaps = false
  t.minFilter = THREE.LinearFilter
  return t
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** 柔和徑向漸層光暈（白色，alpha 由中心向外平滑衰減） */
let glowTex: THREE.CanvasTexture | undefined
const glow = () =>
  (glowTex ??= canvasTex(
    128,
    (_, set) => {
      for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++) {
          const r = Math.hypot((x + 0.5) / 64 - 1, (y + 0.5) / 64 - 1)
          // 近似高斯：中心亮、邊緣到 0
          set(y * 128 + x, Math.exp(-r * r * 3.2) * (1 - smooth(0.75, 1, r)))
        }
    },
    true,
  ))

/** 軟陰影墊片的邊緣漸層（灰階，當 alphaMap）：中央 1 → 邊緣 0，九宮格用，邊寬固定為世界座標 */
let padTex: THREE.CanvasTexture | undefined
const pad = () =>
  (padTex ??= canvasTex(
    128,
    (_, set) => {
      const ramp = (t: number) => smooth(0, 0.5, Math.min(t, 1 - t))
      for (let y = 0; y < 128; y++)
        for (let x = 0; x < 128; x++) set(y * 128 + x, ramp((x + 0.5) / 128) * ramp((y + 0.5) / 128))
    },
    false,
  ))

/** 一維漸層（v 方向 1 → 0），牆腳 / 牆頂暗角帶用 */
let stripTex: THREE.CanvasTexture | undefined
const strip = () =>
  (stripTex ??= canvasTex(
    64,
    (_, set) => {
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) set(y * 64 + x, Math.pow(1 - (y + 0.5) / 64, 2))
    },
    false,
  ))

/* ------------------------------ 光斑 ------------------------------ */

const glowMats = new Map<string, THREE.MeshBasicMaterial>()
function glowMat(color: string, opacity: number) {
  const k = color + opacity
  let m = glowMats.get(k)
  if (!m) {
    m = new THREE.MeshBasicMaterial({
      map: glow(),
      color,
      opacity,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: true,
    })
    glowMats.set(k, m)
  }
  return m
}

const unitPlane = new THREE.PlaneGeometry(1, 1)

interface Hit {
  point: THREE.Vector3
  normal: THREE.Vector3
  t: number
}

/** 射線打到地板 / 牆體的第一個交點（牆當作 [長+厚] × 高 × 厚 的方塊；開口忽略，窗上的光斑視為玻璃反光） */
function castRay(o: THREE.Vector3, d: THREE.Vector3, walls: Wall[]): Hit | null {
  let best: Hit | null = null
  if (d.y < -1e-4) {
    const t = -o.y / d.y
    best = { t, point: o.clone().addScaledVector(d, t), normal: new THREE.Vector3(0, 1, 0) }
  }
  for (const w of walls) {
    if (w.style === 'railing') continue
    const dx = w.end[0] - w.start[0]
    const dz = w.end[1] - w.start[1]
    const len = Math.hypot(dx, dz)
    if (len < 1e-3) continue
    const ux = dx / len
    const uz = dz / len
    const mx = (w.start[0] + w.end[0]) / 2
    const mz = (w.start[1] + w.end[1]) / 2
    const lo = [(o.x - mx) * ux + (o.z - mz) * uz, o.y, -(o.x - mx) * uz + (o.z - mz) * ux]
    const ld = [d.x * ux + d.z * uz, d.y, -d.x * uz + d.z * ux]
    const min = [-(len + w.thickness) / 2, 0, -w.thickness / 2]
    const max = [(len + w.thickness) / 2, w.height, w.thickness / 2]
    let t0 = 1e-3
    let t1 = 1e9
    let axis = -1
    let sign = 1
    for (let a = 0; a < 3; a++) {
      if (Math.abs(ld[a]) < 1e-9) {
        if (lo[a] < min[a] || lo[a] > max[a]) {
          t1 = -1
          break
        }
        continue
      }
      let ta = (min[a] - lo[a]) / ld[a]
      let tb = (max[a] - lo[a]) / ld[a]
      let s = -1
      if (ta > tb) {
        ;[ta, tb] = [tb, ta]
        s = 1
      }
      if (ta > t0) {
        t0 = ta
        axis = a
        sign = s
      }
      t1 = Math.min(t1, tb)
      if (t0 > t1) break
    }
    if (axis < 0 || t0 > t1 || (best && t0 >= best.t)) continue
    const n = [0, 0, 0]
    n[axis] = sign
    best = {
      t: t0,
      point: o.clone().addScaledVector(d, t0),
      normal: new THREE.Vector3(n[0] * ux - n[2] * uz, n[1], n[0] * uz + n[2] * ux),
    }
  }
  return best
}

interface DecalProps {
  point: THREE.Vector3
  normal: THREE.Vector3
  /** 光線方向（單位向量）：用來把橢圓拉長到入射方向 */
  dir: THREE.Vector3
  size: number
  /** 沿入射方向的拉長上限 */
  stretch?: number
  color: string
  opacity: number
  /** 長條光（燈條）：沿 tangent 軸的長寬，覆寫 size */
  rect?: [number, number]
}

function Decal({ point, normal, dir, size, stretch = 2.2, color, opacity, rect }: DecalProps) {
  const { q, pos, sx, sy } = useMemo(() => {
    const n = normal
    let u = dir.clone().addScaledVector(n, -dir.dot(n))
    if (u.lengthSq() < 1e-4) u = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    u.normalize()
    const v = new THREE.Vector3().crossVectors(n, u)
    const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n))
    const cosT = Math.max(Math.abs(dir.dot(n)), 1 / stretch)
    return {
      q: quat,
      pos: point.clone().addScaledVector(n, 0.012),
      sx: rect ? rect[0] : size / cosT,
      sy: rect ? rect[1] : size,
    }
  }, [point, normal, dir, size, stretch, rect])
  return <mesh geometry={unitPlane} material={glowMat(color, opacity)} position={pos} quaternion={q} scale={[sx, sy, 1]} renderOrder={3} raycast={() => null} />
}

const DOWN = new THREE.Vector3(0, -1, 0)
const WARM_STRIP = '#ffb46b'

function headAt(it: MepItem, i: number, heads: number): [number, number, number] {
  const len = it.length ?? 1
  const t = heads === 1 ? 0 : (i / (heads - 1) - 0.5) * (len - 0.3)
  return [it.at[0] + (it.dir === 'z' ? 0 : t), it.h - 0.08, it.at[1] + (it.dir === 'z' ? t : 0)]
}

/** 取代 Fixtures.tsx 內全部 Spot / Point Light 的光斑貼片 */
export function BakedLights({ color }: { color: string }) {
  const walls = useLayout((s) => s.layout.walls)
  const decals = useMemo(() => {
    const out: DecalProps[] = []
    const add = (o: THREE.Vector3, d: THREE.Vector3, size: number, opacity: number, c: string, stretch?: number, rect?: [number, number]) => {
      const hit = castRay(o, d, walls)
      if (!hit) return
      out.push({ point: hit.point, normal: hit.normal, dir: d, size, stretch, color: c, opacity, rect })
    }
    for (const it of MEP_ITEMS) {
      if (it.kind === 'track') {
        const heads = it.heads ?? 0
        const aims = TRACK_AIM[it.id] ?? []
        for (let i = 0; i < heads; i++) {
          const at = new THREE.Vector3(...headAt(it, i, heads))
          const aim = aims[i] ? new THREE.Vector3(...aims[i]) : new THREE.Vector3(it.at[0], 0.4, it.at[1])
          const d = aim.clone().sub(at).normalize()
          const hit = castRay(at, d, walls)
          if (!hit) continue
          // 光錐半角約 0.65 rad：光斑寬度隨距離放大
          const size = Math.min(2.6, Math.max(0.8, hit.t * 0.95))
          out.push({ point: hit.point, normal: hit.normal, dir: d, size, color, opacity: hit.normal.y > 0.5 ? 0.3 : 0.32 })
        }
      } else if (it.kind === 'ceiling' || it.kind === 'fan') {
        const d = (it.diameter ?? 0.4) > 0.3 ? 3.6 : 2.6
        add(new THREE.Vector3(it.at[0], it.h - 0.15, it.at[1]), DOWN, d, it.kind === 'fan' ? 0.3 : 0.26, color)
      } else if (it.kind === 'downlight') {
        add(new THREE.Vector3(it.at[0], it.h - 0.03, it.at[1]), DOWN, 1.9, 0.2, color)
      } else if (it.kind === 'strip') {
        const len = it.length ?? 1
        add(new THREE.Vector3(it.at[0], it.h - 0.05, it.at[1]), DOWN, 1, 0.2, WARM_STRIP, 1, it.dir === 'z' ? [0.9, len + 0.5] : [len + 0.5, 0.9])
      }
    }
    return out
  }, [walls, color])
  return (
    <group name="baked-lights">
      {decals.map((d, i) => (
        <Decal key={i} {...d} />
      ))}
    </group>
  )
}

/* ------------------------------ 接觸陰影 ------------------------------ */

const padGeoCache = new Map<string, THREE.BufferGeometry>()
/** 九宮格軟陰影墊片：中央（= 家具佔地）全黑，邊緣向外 m 公尺漸淡；邊寬是世界座標，不隨家具大小拉伸 */
function padGeometry(w: number, d: number, m: number) {
  const k = `${w.toFixed(3)}|${d.toFixed(3)}|${m}`
  let g = padGeoCache.get(k)
  if (!g) {
    g = new THREE.PlaneGeometry(1, 1, 3, 3)
    const p = g.attributes.position as THREE.BufferAttribute
    const uv = g.attributes.uv as THREE.BufferAttribute
    const xs = [-w / 2 - m, -w / 2, w / 2, w / 2 + m]
    const zs = [-d / 2 - m, -d / 2, d / 2, d / 2 + m]
    const us = [0, 0.5, 0.5, 1]
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        const idx = j * 4 + i
        p.setXYZ(idx, xs[i], zs[j], 0)
        uv.setXY(idx, us[i], us[j])
      }
    g.rotateX(-Math.PI / 2)
    padGeoCache.set(k, g)
  }
  return g
}

let padMat: THREE.MeshBasicMaterial | undefined
const padMaterial = () =>
  (padMat ??= new THREE.MeshBasicMaterial({
    color: '#000000',
    alphaMap: pad(),
    opacity: 0.55,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  }))

/** 家具底部的軟陰影墊片：放在家具 group 內（跟著移動 / 旋轉），貼地 y = 0.0075（地板分區最高約 0.007） */
export function ShadowPad({ size }: { size: [number, number, number] }) {
  const geo = useMemo(() => padGeometry(size[0], size[2], Math.min(0.18, 0.06 + Math.min(size[0], size[2]) * 0.1)), [size])
  return <mesh geometry={geo} material={padMaterial()} position={[0, 0.0075, 0]} renderOrder={2} raycast={() => null} />
}

let stripMat: THREE.MeshBasicMaterial | undefined
const stripMaterial = () =>
  (stripMat ??= new THREE.MeshBasicMaterial({
    color: '#000000',
    alphaMap: strip(),
    opacity: 0.4,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide, // 三角形繞序隨左右側不同
  }))

const STRIP_W = 0.15

/** 牆腳（地面）與牆頂（垂直面，僅第一人稱有天花板時顯示）15 cm 暗角帶，各合併成單一 mesh，避開門洞 */
export function CornerAO() {
  const walls = useLayout((s) => s.layout.walls)
  const fp = useUi((s) => s.viewMode) === 'firstPerson'
  const { floorGeo, topGeo } = useMemo(() => {
    const fPos: number[] = []
    const fUv: number[] = []
    const tPos: number[] = []
    const tUv: number[] = []
    const quad = (pos: number[], uv: number[], a: number[], b: number[], c: number[], e: number[]) => {
      // a-b 為貼牆的邊（v=0，最暗），c-e 為遠離牆的邊（v=1）
      pos.push(...a, ...b, ...c, ...a, ...c, ...e)
      uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1)
    }
    for (const w of walls) {
      if (w.style === 'railing') continue
      const dx = w.end[0] - w.start[0]
      const dz = w.end[1] - w.start[1]
      const len = Math.hypot(dx, dz)
      if (len < 0.2) continue
      const ux = dx / len
      const uz = dz / len
      // 沿牆可布置暗角的區段 = 全長扣掉門洞
      const doors = w.openings.filter((o) => o.type === 'door').map((o) => [o.at - o.width / 2, o.at + o.width / 2]).sort((a, b) => a[0] - b[0])
      const segs: [number, number][] = []
      let cur = -w.thickness / 2
      for (const [a, b] of doors) {
        if (a > cur) segs.push([cur, a])
        cur = Math.max(cur, b)
      }
      segs.push([cur, len + w.thickness / 2])
      for (const [s0, s1] of segs) {
        if (s1 - s0 < 0.05) continue
        for (const side of [-1, 1]) {
          const nx = -uz * side
          const nz = ux * side
          const off = w.thickness / 2 + 0.002
          const p = (s: number, o: number, y: number) => [w.start[0] + ux * s + nx * o, y, w.start[1] + uz * s + nz * o]
          // 地面帶
          quad(fPos, fUv, p(s0, off, 0.0065), p(s1, off, 0.0065), p(s1, off + STRIP_W, 0.0065), p(s0, off + STRIP_W, 0.0065))
          // 牆頂帶（垂直，往下 15 cm）
          quad(tPos, tUv, p(s0, off, w.height - 0.003), p(s1, off, w.height - 0.003), p(s1, off, w.height - STRIP_W), p(s0, off, w.height - STRIP_W))
        }
      }
    }
    const mk = (pos: number[], uv: number[]) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      return g
    }
    return { floorGeo: mk(fPos, fUv), topGeo: mk(tPos, tUv) }
  }, [walls])
  return (
    <>
      <mesh geometry={floorGeo} material={stripMaterial()} renderOrder={2} raycast={() => null} frustumCulled={false} />
      {fp && <mesh geometry={topGeo} material={stripMaterial()} renderOrder={2} raycast={() => null} frustumCulled={false} />}
    </>
  )
}
