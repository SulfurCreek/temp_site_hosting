import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { DEFAULT_MATERIAL, usePBRMaterial } from '../lib/materials'
import { useMetricBox } from '../lib/geometry'
import { loadBaseTexture } from '../lib/textures'
import { findCatalogItem, useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import type { CatalogItem, Decal, FurnitureInstance, MaterialSpec, Vec3 } from '../types'
import { ErrorBoundary } from '../ui/ErrorBoundary'
import { objectRegistry } from './registry'

const D = Math.PI / 180

/* ------------------------------------------------------------------ */
/* 共用積木：以實際公尺為 UV 的方塊                                      */
/* ------------------------------------------------------------------ */

function Box({
  pos,
  dims,
  mat,
  shadow = true,
}: {
  pos: Vec3
  dims: Vec3
  mat: THREE.Material
  shadow?: boolean
}) {
  const geo = useMetricBox(dims[0], dims[1], dims[2])
  return <mesh geometry={geo} material={mat} position={pos} castShadow={shadow} receiveShadow />
}

type Mats = { main: THREE.Material; secondary: THREE.Material; accent: THREE.Material }
interface GenProps {
  w: number
  h: number
  d: number
  count: number
  niche?: { w: number; h: number }
  m: Mats
}

/* ------------------------------------------------------------------ */
/* 模式 B：參數化 PBR 積木。原點 = 底部中心，正面朝 +Z                      */
/* ------------------------------------------------------------------ */

function TableGen({ w, h, d, m }: GenProps) {
  const tt = Math.min(0.045, h * 0.14)
  const lw = Math.min(0.06, w * 0.09, d * 0.09)
  const inset = Math.min(0.05, w * 0.06)
  const lx = w / 2 - lw / 2 - inset
  const lz = d / 2 - lw / 2 - inset
  const lh = h - tt
  return (
    <>
      <Box pos={[0, h - tt / 2, 0]} dims={[w, tt, d]} mat={m.main} />
      {[
        [-lx, -lz],
        [lx, -lz],
        [-lx, lz],
        [lx, lz],
      ].map(([x, z], i) => (
        <Box key={i} pos={[x, lh / 2, z]} dims={[lw, lh, lw]} mat={m.secondary} />
      ))}
    </>
  )
}

function ChairGen({ w, h, d, m }: GenProps) {
  const sh = h * 0.53
  const st = 0.05
  const lw = Math.min(0.045, w * 0.1)
  const lx = w / 2 - lw / 2
  const lz = d / 2 - lw / 2
  return (
    <>
      <Box pos={[0, sh - st / 2, 0]} dims={[w, st, d]} mat={m.main} />
      <Box pos={[0, sh + (h - sh) / 2, -d / 2 + 0.02]} dims={[w, h - sh, 0.04]} mat={m.main} />
      {[
        [-lx, -lz],
        [lx, -lz],
        [-lx, lz],
        [lx, lz],
      ].map(([x, z], i) => (
        <Box key={i} pos={[x, (sh - st) / 2, z]} dims={[lw, sh - st, lw]} mat={m.secondary} />
      ))}
    </>
  )
}

function SofaGen({ w, h, d, count, m }: GenProps) {
  const lh = Math.min(0.09, h * 0.12) // 椅腳
  const armW = Math.min(0.18, w * 0.13)
  const backT = Math.min(0.24, d * 0.26)
  const baseTop = lh + (h - lh) * 0.32
  const cushH = (h - lh) * 0.17
  const armTop = lh + (h - lh) * 0.72
  const innerW = w - armW * 2
  const cw = innerW / count
  const seatD = d - backT
  const lw = 0.05
  return (
    <>
      {/* 腳 */}
      {[
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ].map(([sx, sz], i) => (
        <Box key={i} pos={[sx * (w / 2 - 0.07), lh / 2, sz * (d / 2 - 0.07)]} dims={[lw, lh, lw]} mat={m.secondary} />
      ))}
      {/* 底座、靠背、扶手 */}
      {/* 底座內縮 3mm，避免與扶手/靠背共平面閃爍 */}
      <Box pos={[0, lh + (baseTop - lh) / 2, 0.003]} dims={[w - 0.006, baseTop - lh, d - 0.006]} mat={m.main} />
      <Box pos={[0, lh + (h - lh) / 2, -d / 2 + backT / 2]} dims={[w, h - lh, backT]} mat={m.main} />
      {[-1, 1].map((s) => (
        <Box
          key={s}
          pos={[s * (w / 2 - armW / 2), lh + (armTop - lh) / 2, backT / 2]}
          dims={[armW, armTop - lh, d - backT]}
          mat={m.main}
        />
      ))}
      {/* 坐墊 + 靠墊 */}
      {Array.from({ length: count }, (_, i) => {
        const x = -innerW / 2 + cw * (i + 0.5)
        return (
          <group key={i}>
            <Box pos={[x, baseTop + cushH / 2, backT / 2]} dims={[cw - 0.01, cushH, seatD - 0.01]} mat={m.main} />
            <Box
              pos={[x, baseTop + cushH + (h - baseTop - cushH) * 0.42, -d / 2 + backT + 0.07]}
              dims={[cw - 0.02, (h - baseTop - cushH) * 0.8, 0.14]}
              mat={m.main}
            />
          </group>
        )
      })}
      {/* 抱枕 */}
      {[-1, 1].slice(0, count > 1 ? 2 : 1).map((s) => (
        <group key={s} position={[s * (innerW / 2 - 0.2), baseTop + cushH + 0.17, -d / 2 + backT + 0.18]} rotation={[-0.25, s * 0.35, 0]}>
          <Box pos={[0, 0, 0]} dims={[0.38, 0.38, 0.11]} mat={m.accent} />
        </group>
      ))}
    </>
  )
}

/** 含壁龕的櫃體：兩側板 + 背板 + 上櫃（含門片），中間開放放電子衣櫥 */
function NicheCabinetGen({ w, h, d, niche, m }: GenProps & { niche: { w: number; h: number } }) {
  const nw = Math.min(niche.w, w - 0.04)
  const nh = Math.min(niche.h, h - 0.1)
  const side = (w - nw) / 2
  const top = h - nh
  return (
    <>
      {[-1, 1].map((sgn) => (
        <Box key={sgn} pos={[sgn * (w / 2 - side / 2), h / 2, 0]} dims={[side, h, d]} mat={m.main} />
      ))}
      <Box pos={[0, nh / 2, -d / 2 + 0.01]} dims={[nw, nh, 0.02]} mat={m.secondary} />
      <Box pos={[0, nh + top / 2, 0]} dims={[nw, top, d - 0.02]} mat={m.secondary} />
      <Box pos={[0, nh + top / 2, d / 2 - 0.009]} dims={[nw - 0.004, top - 0.008, 0.018]} mat={m.main} />
      <Box pos={[0, nh - 0.01, 0]} dims={[nw, 0.02, d - 0.04]} mat={m.secondary} shadow={false} />
    </>
  )
}

function CabinetGen({ w, h, d, count, niche, m }: GenProps) {
  if (niche) return <NicheCabinetGen w={w} h={h} d={d} count={count} niche={niche} m={m} />
  const plinth = Math.min(0.08, h * 0.1)
  const bodyH = h - plinth
  const n = Math.max(1, count)
  const dw = w / n
  const handleH = Math.min(0.28, bodyH * 0.3)
  const tall = h > 1.5
  return (
    <>
      {/* 踢腳（內縮） */}
      <Box pos={[0, plinth / 2, -0.015]} dims={[w - 0.04, plinth, d - 0.05]} mat={m.secondary} />
      {/* 櫃體 */}
      <Box pos={[0, plinth + bodyH / 2, -0.01]} dims={[w, bodyH, d - 0.02]} mat={m.secondary} />
      {/* 門片 */}
      {Array.from({ length: n }, (_, i) => {
        const x = -w / 2 + dw * (i + 0.5)
        const splitH = tall ? bodyH * 0.62 : bodyH
        return (
          <group key={i}>
            <Box pos={[x, plinth + splitH / 2 + 0.002, d / 2 - 0.009]} dims={[dw - 0.006, splitH - 0.008, 0.018]} mat={m.main} />
            {tall && (
              <Box
                pos={[x, plinth + splitH + (bodyH - splitH) / 2, d / 2 - 0.009]}
                dims={[dw - 0.006, bodyH - splitH - 0.008, 0.018]}
                mat={m.main}
              />
            )}
            <Box
              pos={[x + (i % 2 === 0 ? 1 : -1) * (dw / 2 - 0.035), plinth + (tall ? splitH * 0.5 : bodyH * 0.5), d / 2 + 0.012]}
              dims={[0.012, handleH, 0.016]}
              mat={m.accent}
              shadow={false}
            />
          </group>
        )
      })}
    </>
  )
}

function BedGen({ w, h, d, m }: GenProps) {
  const fh = 0.28
  return (
    <>
      <Box pos={[0, fh / 2, 0]} dims={[w, fh, d]} mat={m.secondary} />
      <Box pos={[0, fh + 0.11, 0.02]} dims={[w - 0.06, 0.22, d - 0.1]} mat={m.main} />
      <Box pos={[0, h / 2, -d / 2 + 0.035]} dims={[w + 0.04, h, 0.08]} mat={m.secondary} />
      <Box pos={[0, fh + 0.24, d * 0.18]} dims={[w - 0.04, 0.04, d * 0.6]} mat={m.accent} />
      {[-1, 1].map((s) => (
        <Box key={s} pos={[s * w * 0.22, fh + 0.27, -d / 2 + 0.3]} dims={[w * 0.38, 0.1, 0.4]} mat={m.main} />
      ))}
    </>
  )
}

function ToiletGen({ w, h, d, m }: GenProps) {
  const tankD = d * 0.22
  const bowlD = d - tankD
  return (
    <>
      <Box pos={[0, h / 2, -d / 2 + tankD / 2]} dims={[w * 0.92, h, tankD]} mat={m.main} />
      <Box pos={[0, 0.2, d / 2 - bowlD / 2]} dims={[w * 0.9, 0.4, bowlD]} mat={m.main} />
      <Box pos={[0, 0.415, d / 2 - bowlD / 2]} dims={[w * 0.96, 0.035, bowlD * 0.96]} mat={m.secondary} />
    </>
  )
}

function SinkGen({ w, h, d, m }: GenProps) {
  return (
    <>
      <Box pos={[0, h / 2, 0]} dims={[w, h, d]} mat={m.main} />
      <Box pos={[0, h + 0.002, 0.01]} dims={[w * 0.82, 0.004, d * 0.7]} mat={m.secondary} shadow={false} />
      <Box pos={[0, h + 0.1, -d / 2 + 0.03]} dims={[0.025, 0.2, 0.025]} mat={m.accent} />
      <Box pos={[0, h + 0.19, -d / 2 + 0.09]} dims={[0.02, 0.02, 0.14]} mat={m.accent} />
    </>
  )
}

function Cyl({ pos, r, h, mat }: { pos: Vec3; r: number; h: number; mat: THREE.Material }) {
  return (
    <mesh position={pos} material={mat} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, h, 24]} />
    </mesh>
  )
}

/** 圓形單柱桌：w = 桌面直徑；main = 桌面與柱身，secondary = 底座 */
function RoundTableGen({ w, h, m }: GenProps) {
  const r = w / 2
  const tt = Math.min(0.04, h * 0.06)
  return (
    <>
      <Cyl pos={[0, h - tt / 2, 0]} r={r} h={tt} mat={m.main} />
      <Cyl pos={[0, (h - tt) / 2, 0]} r={r * 0.3} h={h - tt} mat={m.main} />
      <Cyl pos={[0, 0.01, 0]} r={r * 0.42} h={0.02} mat={m.secondary} />
    </>
  )
}

/** 壁掛立柱層架（rareraw SYSTEM000 型）：兩支立柱 + count 片層板，層板兩側有 9.5cm 側擋、前緣 5cm 擋條 */
function ShelfGen({ w, h, d, count, m }: GenProps) {
  const rail = 0.02
  const t = 0.012
  const n = Math.max(1, count)
  const gap = (h - 0.1) / n
  return (
    <>
      {[-1, 1].map((s) => (
        <Box key={s} pos={[s * (w / 2 - 0.05), h / 2, -d / 2 + rail / 2]} dims={[rail, h, rail]} mat={m.secondary} />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const y = 0.1 + i * gap
        return (
          <group key={i}>
            <Box pos={[0, y, 0]} dims={[w, t, d]} mat={m.main} />
            {[-1, 1].map((s) => (
              <Box key={s} pos={[s * (w / 2 - t / 2), y + 0.0475, 0]} dims={[t, 0.095, d]} mat={m.main} />
            ))}
            <Box pos={[0, y + 0.025, d / 2 - t / 2]} dims={[w, 0.05, t]} mat={m.main} />
          </group>
        )
      })}
    </>
  )
}

function HobGen({ w, h, d, m }: GenProps) {
  const r = Math.min(d * 0.36, w * 0.2)
  return (
    <>
      <Box pos={[0, h / 2, 0]} dims={[w, h, d]} mat={m.main} />
      {[-1, 1].map((s) => (
        <Cyl key={s} pos={[s * w * 0.25, h + 0.01, 0]} r={r} h={0.02} mat={m.secondary} />
      ))}
    </>
  )
}

function ParametricModel({
  item,
  inst,
  size,
}: {
  item: CatalogItem
  inst: FurnitureInstance
  size: Vec3
}) {
  const p = item.parametric!
  const main = usePBRMaterial(inst.materials?.main ?? p.materials.main)
  const secondary = usePBRMaterial(inst.materials?.secondary ?? p.materials.secondary ?? p.materials.main)
  const accent = usePBRMaterial(inst.materials?.accent ?? p.materials.accent ?? p.materials.main)
  const m = useMemo<Mats>(() => ({ main, secondary, accent }), [main, secondary, accent])
  const [w, h, d] = size
  const props: GenProps = { w, h, d, count: p.count ?? 1, niche: p.niche, m }
  const decals = inst.decals ?? p.decals

  let body
  switch (p.kind) {
    case 'table':
      body = <TableGen {...props} />
      break
    case 'chair':
      body = <ChairGen {...props} />
      break
    case 'sofa':
      body = <SofaGen {...props} />
      break
    case 'cabinet':
      body = <CabinetGen {...props} />
      break
    case 'bed':
      body = <BedGen {...props} />
      break
    case 'toilet':
      body = <ToiletGen {...props} />
      break
    case 'sink':
      body = <SinkGen {...props} />
      break
    case 'hob':
      body = <HobGen {...props} />
      break
    case 'roundtable':
      body = <RoundTableGen {...props} />
      break
    case 'shelf':
      body = <ShelfGen {...props} />
      break
    case 'rug':
    case 'box':
    default:
      body = <Box pos={[0, h / 2, 0]} dims={[w, h, d]} mat={main} />
  }
  return (
    <>
      {body}
      {decals?.map((dc, i) => (
        <DecalPlane key={i} decal={dc} size={size} />
      ))}
    </>
  )
}

/** 把商品照貼在家具表面（模式 B 的「貼商品照」） */
function DecalPlane({ decal, size }: { decal: Decal; size: Vec3 }) {
  const [w, h, d] = size
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let alive = true
    let c: THREE.Texture | null = null
    loadBaseTexture(decal.url)
      .then((t) => {
        if (!alive) return
        c = t.clone()
        c.needsUpdate = true
        setTex(c)
      })
      .catch(() => alive && setTex(null))
    return () => {
      alive = false
      c?.dispose()
    }
  }, [decal.url])

  const cfg = useMemo(() => {
    const top = decal.face === 'top'
    const side = decal.face === 'left' || decal.face === 'right'
    const fw = side ? d : w
    const fh = top ? d : h
    const eps = 0.003
    const pos: Vec3 =
      decal.face === 'front'
        ? [0, h / 2, d / 2 + eps]
        : decal.face === 'back'
          ? [0, h / 2, -d / 2 - eps]
          : decal.face === 'right'
            ? [w / 2 + eps, h / 2, 0]
            : decal.face === 'left'
              ? [-w / 2 - eps, h / 2, 0]
              : [0, h + eps, 0]
    const rot: Vec3 =
      decal.face === 'front'
        ? [0, 0, 0]
        : decal.face === 'back'
          ? [0, Math.PI, 0]
          : decal.face === 'right'
            ? [0, Math.PI / 2, 0]
            : decal.face === 'left'
              ? [0, -Math.PI / 2, 0]
              : [-Math.PI / 2, 0, 0]
    return { fw, fh, pos, rot }
  }, [decal.face, w, h, d])

  const fit = decal.fit ?? 'cover'
  const dims = useMemo(() => {
    const img = tex?.image as { naturalWidth?: number; width?: number; naturalHeight?: number; height?: number } | undefined
    const ia = (img?.naturalWidth || img?.width || 1) / (img?.naturalHeight || img?.height || 1)
    const fa = cfg.fw / cfg.fh
    let pw = cfg.fw
    let ph = cfg.fh
    const rep: [number, number] = [1, 1]
    const off: [number, number] = [0, 0]
    if (fit === 'contain') {
      if (ia > fa) ph = cfg.fw / ia
      else pw = cfg.fh * ia
    } else if (fit === 'cover') {
      if (ia > fa) {
        rep[0] = fa / ia
        off[0] = (1 - rep[0]) / 2
      } else {
        rep[1] = ia / fa
        off[1] = (1 - rep[1]) / 2
      }
    }
    return { pw, ph, rep, off }
  }, [tex, cfg, fit])

  useEffect(() => {
    if (!tex) return
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    tex.repeat.set(dims.rep[0], dims.rep[1])
    tex.offset.set(dims.off[0], dims.off[1])
    tex.needsUpdate = true
  }, [tex, dims])

  if (!tex) return null
  return (
    <mesh position={cfg.pos} rotation={cfg.rot}>
      <planeGeometry args={[dims.pw, dims.ph]} />
      <meshStandardMaterial map={tex} transparent alphaTest={0.02} roughness={0.7} polygonOffset polygonOffsetFactor={-2} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* 模式 A：.glb 模型                                                    */
/* ------------------------------------------------------------------ */

function GlbModel({ url, size, fit }: { url: string; size: Vec3; fit: 'stretch' | 'contain' }) {
  const { scene } = useGLTF(url)
  const { obj, scale, offset } = useMemo(() => {
    const o = scene.clone(true)
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true
        c.receiveShadow = true
      }
    })
    const box = new THREE.Box3().setFromObject(o)
    const sz = box.getSize(new THREE.Vector3())
    const ctr = box.getCenter(new THREE.Vector3())
    const sx = size[0] / Math.max(sz.x, 1e-6)
    const sy = size[1] / Math.max(sz.y, 1e-6)
    const sz2 = size[2] / Math.max(sz.z, 1e-6)
    const u = Math.min(sx, sy, sz2)
    const s = fit === 'contain' ? new THREE.Vector3(u, u, u) : new THREE.Vector3(sx, sy, sz2)
    // 把模型底部中心移到原點
    const off = new THREE.Vector3(-ctr.x * s.x, -box.min.y * s.y, -ctr.z * s.z)
    return { obj: o, scale: s, offset: off }
  }, [scene, size, fit])
  return (
    <group position={offset} scale={scale}>
      <primitive object={obj} />
    </group>
  )
}

function Placeholder({ size, color = '#94a3b8', wire = false }: { size: Vec3; color?: string; wire?: boolean }) {
  return (
    <mesh position={[0, size[1] / 2, 0]}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent opacity={wire ? 0.25 : 0.5} wireframe={wire} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/* 模式 C：2.5D 智慧立牌                                                */
/* ------------------------------------------------------------------ */

function BillboardModel({
  item,
  inst,
  size,
}: {
  item: CatalogItem
  inst: FurnitureInstance
  size: Vec3
}) {
  const [w, h, d] = size
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  const ref = useRef<THREE.Group>(null)

  useEffect(() => {
    let alive = true
    loadBaseTexture(item.billboard!.image)
      .then((t) => alive && setTex(t))
      .catch(() => alive && setTex(null))
    return () => {
      alive = false
    }
  }, [item.billboard])

  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), [w, h, d])
  useEffect(() => () => edges.dispose(), [edges])

  // 立牌可選擇持續朝向鏡頭（只轉 Y 軸）
  useFrame(({ camera }) => {
    const g = ref.current
    if (!g) return
    if (!inst.faceCamera) {
      g.rotation.y = 0
      return
    }
    const a = Math.atan2(camera.position.x - inst.position[0], camera.position.z - inst.position[2])
    g.rotation.y = a - inst.rotationY * D
  })

  return (
    <group ref={ref}>
      {/* 立體卡片：貼圖片（alpha 去背） */}
      {tex ? (
        <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial map={tex} transparent alphaTest={0.4} side={THREE.DoubleSide} roughness={0.85} />
        </mesh>
      ) : (
        <Placeholder size={[w, h, 0.02]} />
      )}
      {/* 真實長寬高的碰撞框：可點選、可看出佔位體積 */}
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <lineSegments geometry={edges} position={[0, h / 2, 0]}>
        <lineBasicMaterial color="#64748b" transparent opacity={0.55} />
      </lineSegments>
      {/* 地面佔地 */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* 混合式家具載入器                                                      */
/* ------------------------------------------------------------------ */

function HybridModel({ item, inst }: { item: CatalogItem; inst: FurnitureInstance }) {
  const size = inst.size
  switch (item.mode) {
    case 'glb':
      return (
        <ErrorBoundary fallback={<Placeholder size={size} color="#f87171" />}>
          <Suspense fallback={<Placeholder size={size} wire />}>
            <GlbModel url={item.glb!.url} size={size} fit={item.glb!.fit ?? 'stretch'} />
          </Suspense>
        </ErrorBoundary>
      )
    case 'billboard':
      return <BillboardModel item={item} inst={inst} size={size} />
    default:
      return <ParametricModel item={item} inst={inst} size={size} />
  }
}

/* ------------------------------------------------------------------ */
/* 單一家具實例：選取 / 直接拖拉                                          */
/* ------------------------------------------------------------------ */

const FALLBACK_ITEM = (inst: FurnitureInstance): CatalogItem => ({
  id: inst.catalogId,
  name: inst.name,
  category: 'custom',
  mode: 'parametric',
  size: inst.size,
  parametric: { kind: 'box', materials: { main: { ...DEFAULT_MATERIAL, color: '#f87171' } as MaterialSpec } },
})

const FurnitureView = memo(function FurnitureView({ inst }: { inst: FurnitureInstance }) {
  const custom = useLayout((s) => s.layout.customCatalog)
  const item = useMemo(() => findCatalogItem(inst.catalogId, custom) ?? FALLBACK_ITEM(inst), [inst, custom])
  const selected = useUi((s) => s.selection?.type === 'furniture' && s.selection.id === inst.id)
  const moving = useUi((s) => s.moving && s.selection?.type === 'furniture' && s.selection.id === inst.id)
  const select = useUi((s) => s.select)
  const groupRef = useRef<THREE.Group>(null)
  // 只在事件當下讀取 R3F 狀態，避免訂閱整個 store 造成每次 resize 都重繪所有家具
  const get = useThree((s) => s.get)

  useEffect(() => {
    const g = groupRef.current
    if (g) objectRegistry.set(inst.id, g)
    return () => {
      objectRegistry.delete(inst.id)
    }
  }, [inst.id])

  const [w, h, d] = inst.size
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), [w, h, d])
  useEffect(() => () => edges.dispose(), [edges])

  /**
   * 點選 ≠ 移動：只有在「移動模式」（屬性面板的「移動」按鈕 / M 鍵）下，按住這件家具拖拉才會移動。
   * 平常按住家具拖曳仍是轉動鏡頭，不會誤移家具。
   */
  const onPointerDown = (e: { stopPropagation: () => void; nativeEvent: PointerEvent; ray: THREE.Ray }) => {
    const ui = useUi.getState()
    if (ui.calib.active) return
    const isSel = ui.selection?.type === 'furniture' && ui.selection.id === inst.id
    if (!ui.moving || !isSel) return
    e.stopPropagation()
    const { tool, snap } = useLayout.getState().settings
    const g = groupRef.current
    if (tool !== 'drag' || inst.locked || !g) return
    const { camera, gl, raycaster, controls } = get()

    // 拖拉期間暫停軌道控制，避免手指/滑鼠同時轉動背景
    const oc = controls as unknown as { enabled: boolean } | null
    if (oc) oc.enabled = false
    useUi.getState().setDragging(true)

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -inst.position[1])
    const hit0 = new THREE.Vector3()
    if (!e.ray.intersectPlane(plane, hit0)) return
    const offX = g.position.x - hit0.x
    const offZ = g.position.z - hit0.z
    const startX = e.nativeEvent.clientX
    const startY = e.nativeEvent.clientY
    const pid = e.nativeEvent.pointerId
    let moved = false
    const ndc = new THREE.Vector2()
    const hit = new THREE.Vector3()

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return
      moved = true
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.ray.intersectPlane(plane, hit)) return
      let x = hit.x + offX
      let z = hit.z + offZ
      if (snap > 0) {
        x = Math.round(x / snap) * snap
        z = Math.round(z / snap) * snap
      }
      g.position.x = x
      g.position.z = z
    }
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      if (oc) oc.enabled = true
      useUi.getState().setDragging(false)
      if (moved) {
        const r = (v: number) => Math.round(v * 1000) / 1000
        useLayout.getState().updateFurniture(inst.id, { position: [r(g.position.x), inst.position[1], r(g.position.z)] })
        // 拖拉放開即完成這次移動，避免之後誤觸
        useUi.getState().setMoving(false)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  return (
    <group
      ref={groupRef}
      position={inst.position}
      rotation-y={inst.rotationY * D}
      onPointerDown={onPointerDown}
      onClick={(e) => {
        // click（R3F 已排除拖曳鏡頭的情況）才選取；同時阻止穿透到後方的地板/牆
        if (useUi.getState().calib.active) return
        e.stopPropagation()
        if (!selected) select({ type: 'furniture', id: inst.id })
      }}
      onPointerOver={() => {
        if (useUi.getState().dragging) return
        document.body.style.cursor = moving ? (inst.locked ? 'not-allowed' : 'grab') : 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
      }}
    >
      <HybridModel item={item} inst={inst} />
      {selected && (
        <lineSegments geometry={edges} position={[0, h / 2, 0]} renderOrder={999}>
          <lineBasicMaterial color={moving ? '#f59e0b' : '#38bdf8'} depthTest={false} transparent />
        </lineSegments>
      )}
    </group>
  )
})

export function FurnitureLayer() {
  const furniture = useLayout((s) => s.layout.furniture)
  return (
    <>
      {furniture.map((f) => (
        <FurnitureView key={f.id} inst={f} />
      ))}
    </>
  )
}
