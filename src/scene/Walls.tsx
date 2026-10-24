import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { makeMetricBox } from '../lib/geometry'
import { usePBRMaterial } from '../lib/materials'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import type { Vec2, Wall } from '../types'

const LOW_HEIGHT = 0.3 // 矮牆模式高度 30 cm
const GHOST_OPACITY = 0.15

interface Piece {
  key: string
  x0: number
  x1: number
  y0: number
  /** 'top' 表示延伸到牆頂（隨破牆高度變化） */
  y1: number | 'top'
  glass?: boolean
}

/** 以開口把牆切成 柱段 / 窗下 / 窗上 / 玻璃 等方塊，牆面本身不需 CSG */
function buildPieces(wall: Wall, len: number): Piece[] {
  const L = len + wall.thickness // 兩端各延伸半個牆厚，轉角才會密合
  const half = L / 2
  const ops = [...wall.openings]
    .map((o) => {
      const c = o.at - len / 2
      return { o, l: Math.max(-half, c - o.width / 2), r: Math.min(half, c + o.width / 2) }
    })
    .filter((x) => x.r - x.l > 0.01)
    .sort((a, b) => a.l - b.l)

  const out: Piece[] = []
  let cursor = -half
  for (const { o, l, r } of ops) {
    if (l - cursor > 0.001) out.push({ key: `c${out.length}`, x0: cursor, x1: l, y0: 0, y1: 'top' })
    cursor = Math.max(cursor, r)
    if (o.sill > 0.001) out.push({ key: `${o.id}-below`, x0: l, x1: r, y0: 0, y1: o.sill })
    if (o.sill + o.height < wall.height - 0.001)
      out.push({ key: `${o.id}-above`, x0: l, x1: r, y0: o.sill + o.height, y1: 'top' })
    if (o.type === 'window')
      out.push({ key: `${o.id}-glass`, x0: l, x1: r, y0: o.sill, y1: o.sill + o.height, glass: true })
  }
  if (half - cursor > 0.001) out.push({ key: `c${out.length}`, x0: cursor, x1: half, y0: 0, y1: 'top' })
  return out
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** 從房間中心指向外側的牆法線（XZ 平面單位向量） */
export function outwardNormal(wall: Wall, center: Vec2): Vec2 {
  const dx = wall.end[0] - wall.start[0]
  const dz = wall.end[1] - wall.start[1]
  const len = Math.hypot(dx, dz) || 1
  let n: Vec2 = [-dz / len, dx / len]
  const mx = (wall.start[0] + wall.end[0]) / 2 - center[0]
  const mz = (wall.start[1] + wall.end[1]) / 2 - center[1]
  if (n[0] * mx + n[1] * mz < 0) n = [-n[0], -n[1]]
  return n
}

function WallView({ wall, center }: { wall: Wall; center: Vec2 }) {
  const selected = useUi((s) => s.selection?.type === 'wall' && s.selection.id === wall.id)
  const select = useUi((s) => s.select)
  const mat = usePBRMaterial(wall.material, { highlight: selected })
  const glassMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#bfe0f5',
        roughness: 0.05,
        metalness: 0,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )

  const geo = useMemo(() => {
    const dx = wall.end[0] - wall.start[0]
    const dz = wall.end[1] - wall.start[1]
    const len = Math.max(Math.hypot(dx, dz), 0.01)
    return {
      len,
      angle: -Math.atan2(dz, dx),
      mid: [(wall.start[0] + wall.end[0]) / 2, (wall.start[1] + wall.end[1]) / 2] as Vec2,
      normal: outwardNormal(wall, center),
    }
  }, [wall, center])

  const pieces = useMemo(() => buildPieces(wall, geo.len), [wall, geo.len])
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const cut = useRef(0) // 0 = 完整，1 = 完全破牆
  const heightNow = useRef(wall.height)
  const applied = useRef(-1)
  const ghosted = useRef(false)

  /** 依目前高度重建每塊方塊的幾何（UV 保持實際公尺比例） */
  const apply = (H: number) => {
    applied.current = H
    pieces.forEach((p, i) => {
      const m = meshes.current[i]
      if (!m) return
      const y1 = p.y1 === 'top' ? H : Math.min(p.y1, H)
      const h = y1 - p.y0
      m.visible = h > 0.002
      if (!m.visible) return
      m.geometry.dispose()
      m.geometry = makeMetricBox(p.x1 - p.x0, h, p.glass ? 0.03 : wall.thickness)
      m.position.set((p.x0 + p.x1) / 2, p.y0 + h / 2, 0)
    })
  }

  useLayoutEffect(() => {
    heightNow.current = Math.min(heightNow.current, wall.height) || wall.height
    apply(heightNow.current)
    return () => {
      meshes.current.forEach((m) => m?.geometry.dispose())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces, wall.thickness, wall.height])

  useFrame(({ camera }, dt) => {
    const mode = useLayout.getState().settings.cutaway
    let target = 0
    if (wall.exterior && mode !== 'off') {
      // 相機相對房間中心的水平方向 v；牆外法線 n 與 v 內積大 → 該牆擋在鏡頭與房間之間
      const vx = camera.position.x - center[0]
      const vz = camera.position.z - center[1]
      const horiz = Math.hypot(vx, vz)
      const dist = Math.hypot(horiz, camera.position.y)
      const dot = horiz > 1e-4 ? (geo.normal[0] * vx + geo.normal[1] * vz) / horiz : 1
      const facing = smoothstep(0.1, 0.45, dot)
      // 幾乎正上方俯視（平面圖）時，所有外牆都降低，才看得到室內
      const top = 1 - smoothstep(0.12, 0.38, horiz / Math.max(dist, 1e-4))
      target = Math.max(facing, top)
    }
    cut.current = THREE.MathUtils.damp(cut.current, target, 9, dt)
    if (Math.abs(cut.current - target) < 0.001) cut.current = target
    const t = cut.current

    const H = mode === 'lower' ? THREE.MathUtils.lerp(wall.height, Math.min(LOW_HEIGHT, wall.height), t) : wall.height
    if (Math.abs(H - applied.current) > 0.0005) {
      heightNow.current = H
      apply(H)
    }
    const op = mode === 'ghost' ? THREE.MathUtils.lerp(1, GHOST_OPACITY, t) : 1
    const base = wall.material.opacity ?? 1
    mat.opacity = base * op
    mat.transparent = mat.opacity < 0.999
    mat.depthWrite = op > 0.6
    glassMat.opacity = 0.28 * op
    ghosted.current = mode === 'ghost' && t > 0.5
  })

  return (
    <group
      position={[geo.mid[0], 0, geo.mid[1]]}
      rotation-y={geo.angle}
      onClick={(e) => {
        if (ghosted.current || useUi.getState().calib.active) return // 透明牆不擋點擊
        e.stopPropagation()
        select({ type: 'wall', id: wall.id })
      }}
    >
      {pieces.map((p, i) => (
        <mesh
          key={p.key}
          ref={(m) => {
            meshes.current[i] = m
          }}
          material={p.glass ? glassMat : mat}
          receiveShadow={!p.glass}
          castShadow={false}
        />
      ))}
    </group>
  )
}

export function Walls() {
  const walls = useLayout((s) => s.layout.walls)
  const fc = useLayout((s) => s.layout.floor.center)
  const center = useMemo<Vec2>(() => [fc[0], fc[1]], [fc])
  return (
    <>
      {walls.map((w) => (
        <WallView key={w.id} wall={w} center={center} />
      ))}
    </>
  )
}
