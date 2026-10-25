import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Vec3 } from '../types'

/**
 * 櫃體用「倒角方塊」：每個零件是 3 mm 木工導角的 RoundedBox，
 * 但同材質的零件在建立時就合併成單一 geometry（每個櫃體只有 3–4 個 draw call），手機也順。
 * UV 仍以公尺計（與 makeMetricBox 一致），貼圖比例不變。
 */

export type PartMat = 'main' | 'secondary' | 'accent' | 'gap'
export interface Part {
  mat: PartMat
  pos: Vec3
  dims: Vec3
  /** 導角半徑（預設 3 mm，會被限制在最小邊的 45% 內） */
  r?: number
}

export const BEVEL = 0.003
/** 門片間縫隙 */
export const GAP = 0.003

const cache = new Map<string, THREE.BufferGeometry>()

function bevelBox(w: number, h: number, d: number, r: number): THREE.BufferGeometry {
  const k = [w, h, d, r].map((n) => n.toFixed(4)).join('|')
  let g = cache.get(k)
  if (g) return g
  g = new RoundedBoxGeometry(w, h, d, 2, r)
  const pos = g.attributes.position as THREE.BufferAttribute
  const nor = g.attributes.normal as THREE.BufferAttribute
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i))
    const ay = Math.abs(nor.getY(i))
    const az = Math.abs(nor.getZ(i))
    const x = pos.getX(i) + w / 2
    const y = pos.getY(i) + h / 2
    const z = pos.getZ(i) + d / 2
    if (ax >= ay && ax >= az) uv.setXY(i, z, y)
    else if (ay >= az) uv.setXY(i, x, z)
    else uv.setXY(i, x, y)
  }
  uv.needsUpdate = true
  cache.set(k, g)
  return g
}

export function mergeParts(parts: Part[]): Partial<Record<PartMat, THREE.BufferGeometry>> {
  const groups: Partial<Record<PartMat, THREE.BufferGeometry[]>> = {}
  for (const p of parts) {
    const [w, h, d] = p.dims
    if (w <= 0.0005 || h <= 0.0005 || d <= 0.0005) continue
    const r = Math.min(p.r ?? BEVEL, Math.min(w, h, d) * 0.45)
    const g = bevelBox(w, h, d, r).clone()
    g.translate(p.pos[0], p.pos[1], p.pos[2])
    ;(groups[p.mat] ??= []).push(g)
  }
  const out: Partial<Record<PartMat, THREE.BufferGeometry>> = {}
  for (const k of Object.keys(groups) as PartMat[]) {
    out[k] = mergeGeometries(groups[k]!, false) ?? undefined
    groups[k]!.forEach((g) => g.dispose())
  }
  return out
}

const GAP_MAT = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 1, metalness: 0 })

export function MergedParts({
  parts,
  m,
}: {
  parts: Part[]
  m: { main: THREE.Material; secondary: THREE.Material; accent: THREE.Material }
}) {
  const geos = useMemo(() => mergeParts(parts), [parts])
  useEffect(() => () => Object.values(geos).forEach((g) => g?.dispose()), [geos])
  const mats: Record<PartMat, THREE.Material> = { ...m, gap: GAP_MAT }
  return (
    <>
      {(Object.keys(geos) as PartMat[]).map((k) => (
        <mesh key={k} geometry={geos[k]} material={mats[k]} castShadow={k !== 'gap'} receiveShadow />
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 櫃體零件配置（純函式，原點 = 底部中心，正面朝 +Z）                       */
/* ------------------------------------------------------------------ */

const DOOR_T = 0.018
const PLINTH_SETBACK = 0.03 // 踢腳板內縮 3 cm

/** 一片門（含 3 mm 縫的縮減）+ 把手 */
function door(
  parts: Part[],
  cx: number,
  y0: number,
  dw: number,
  dh: number,
  d: number,
  handle: 'bar-v' | 'bar-h' | 'pull' | 'none',
  side: 1 | -1,
) {
  const dz = d / 2 - DOOR_T / 2
  parts.push({ mat: 'main', pos: [cx, y0 + dh / 2, dz], dims: [dw - GAP, dh - GAP, DOOR_T] })
  if (handle === 'none') return
  const zf = d / 2 + 0.008
  if (handle === 'bar-v') {
    const hh = Math.min(0.28, dh * 0.3)
    parts.push({ mat: 'accent', pos: [cx + side * (dw / 2 - 0.035), y0 + dh / 2, zf], dims: [0.012, hh, 0.016], r: 0.004 })
  } else if (handle === 'bar-h') {
    const hw = Math.min(0.2, dw * 0.45)
    parts.push({ mat: 'accent', pos: [cx, y0 + dh - 0.04, zf], dims: [hw, 0.012, 0.016], r: 0.004 })
  } else {
    // 嵌入式拉手：門片邊緣一條金屬薄片
    parts.push({ mat: 'accent', pos: [cx + side * (dw / 2 - 0.02), y0 + dh / 2, d / 2 + 0.002], dims: [0.008, 0.14, 0.008], r: 0.002 })
  }
}

export function cabinetParts(w: number, h: number, d: number, count: number): Part[] {
  const parts: Part[] = []
  const low = h < 1
  const plinth = low ? 0.1 : Math.min(0.08, h * 0.1)
  const top = low ? 0.03 : 0 // 檯面厚
  const bodyH = h - plinth - top
  const n = Math.max(1, count)
  const dw = w / n
  const y0 = plinth

  // 踢腳板（內縮 3 cm，形成底部陰影）
  parts.push({ mat: 'secondary', pos: [0, plinth / 2, -PLINTH_SETBACK / 2], dims: [w - 0.02, plinth, d - PLINTH_SETBACK] })
  // 櫃體 + 深色縫隙底板（門片之間透出的黑縫）
  parts.push({ mat: 'secondary', pos: [0, y0 + bodyH / 2, -0.01], dims: [w, bodyH, d - 0.02] })
  parts.push({ mat: 'gap', pos: [0, y0 + bodyH / 2, d / 2 - 0.0195], dims: [w - 0.002, bodyH - 0.002, 0.001], r: 0.0004 })

  const wide = !low && bodyH > 2.2 && dw > 0.9 // 推拉門衣櫃：下門 + 上櫃
  const lowerH = wide ? bodyH - 0.45 : bodyH
  for (let i = 0; i < n; i++) {
    const cx = -w / 2 + dw * (i + 0.5)
    const side: 1 | -1 = i % 2 === 0 ? 1 : -1
    if (low && n >= 3 && i % 2 === 1) {
      // 抽屜：三層
      const dh = bodyH / 3
      for (let j = 0; j < 3; j++) door(parts, cx, y0 + j * dh, dw, dh, d, 'bar-h', side)
    } else {
      door(parts, cx, y0, dw, lowerH, d, wide ? 'pull' : 'bar-v', side)
      if (wide) door(parts, cx, y0 + lowerH, dw, bodyH - lowerH, d, 'none', side)
    }
  }
  if (low) {
    // 檯面：前後各出 1 cm，3 mm 導角
    parts.push({ mat: 'secondary', pos: [0, h - top / 2, 0.005], dims: [w, top, d + 0.01], r: 0.004 })
  }
  return parts
}

/** 含壁龕的櫃體：兩側板 + 背板 + 上櫃（含門片），中間開放放電子衣櫥 */
export function nicheCabinetParts(w: number, h: number, d: number, niche: { w: number; h: number }): Part[] {
  const nw = Math.min(niche.w, w - 0.04)
  const nh = Math.min(niche.h, h - 0.1)
  const side = (w - nw) / 2
  const top = h - nh
  const parts: Part[] = []
  for (const s of [-1, 1]) parts.push({ mat: 'main', pos: [s * (w / 2 - side / 2), h / 2, 0], dims: [side - GAP, h, d] })
  parts.push({ mat: 'secondary', pos: [0, nh / 2, -d / 2 + 0.01], dims: [nw, nh, 0.02] })
  parts.push({ mat: 'secondary', pos: [0, nh + top / 2, 0], dims: [nw, top, d - 0.02] })
  parts.push({ mat: 'gap', pos: [0, nh + top / 2, d / 2 - 0.0195], dims: [nw, top - 0.002, 0.001], r: 0.0004 })
  door(parts, 0, nh, nw, top, d, 'bar-h', 1)
  parts.push({ mat: 'secondary', pos: [0, nh - 0.01, 0], dims: [nw, 0.02, d - 0.04] })
  return parts
}
