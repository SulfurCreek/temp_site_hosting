import { MeshReflectorMaterial } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, type ComponentRef } from 'react'
import * as THREE from 'three'
import type { FloorZone } from '../types'
import { useFxTier } from '../lib/fx'
import { LIGHT_SCENES } from '../lib/lightScenes'
import { useMetricFloor, useMetricPlane } from '../lib/geometry'
import { usePBRMaterial } from '../lib/materials'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'

/**
 * 地面微反射：drei 的 MeshReflectorMaterial 疊上 usePBRMaterial 產生的貼圖與色彩，
 * 讓軌道燈在木地板上有柔和高光與家具倒影。
 * 反射器的虛擬相機只支援透視投影，所以只在透視相機（第一人稱 / 透視）+ high 品質時啟用。
 * 刻意不傳 normalMap：反射器 shader 會拿它扭曲倒影座標，木紋微法線會讓倒影抖動。
 */
function useReflectiveFloor(opaque: boolean) {
  const tier = useFxTier()
  const proof = useLayout((s) => !!s.settings.colorProof)
  const persp = useThree((s) => (s.camera as THREE.PerspectiveCamera).isPerspectiveCamera === true)
  return tier === 'high' && !proof && persp && opaque
}

function ReflectiveSurface({
  mat,
  w,
  d,
  position,
  resolution,
  onClick,
}: {
  mat: THREE.MeshPhysicalMaterial
  w: number
  d: number
  position: [number, number, number]
  resolution: number
  onClick: (e: { stopPropagation: () => void }) => void
}) {
  const geo = useMetricPlane(w, d)
  const ref = useRef<ComponentRef<typeof MeshReflectorMaterial>>(null)
  // 貼圖由 usePBRMaterial 非同步載入並直接寫進 mat：這裡每幀同步（只在貼圖物件改變時才重編 shader）
  useFrame(() => {
    const m = ref.current
    if (!m) return
    if (m.map !== mat.map || m.roughnessMap !== mat.roughnessMap || m.normalMap !== mat.normalMap || m.aoMap !== mat.aoMap) {
      m.map = mat.map
      m.roughnessMap = mat.roughnessMap
      m.normalMap = mat.normalMap
      m.aoMap = mat.aoMap
      m.needsUpdate = true
    }
    m.normalScale.copy(mat.normalScale)
    m.color.copy(mat.color)
    m.roughness = mat.roughness
  })
  return (
    <mesh geometry={geo} rotation-x={-Math.PI / 2} position={position} renderOrder={-1} receiveShadow onClick={onClick}>
      <MeshReflectorMaterial
        ref={ref}
        color={mat.color}
        map={mat.map}
        roughnessMap={mat.roughnessMap}
        roughness={0.55}
        metalness={0}
        blur={[300, 100]}
        resolution={resolution}
        mixBlur={1}
        mixStrength={0.35}
        mirror={0}
      />
    </mesh>
  )
}

export function Floor() {
  const floor = useLayout((s) => s.layout.floor)
  const bp = useLayout((s) => s.layout.blueprint)
  const selected = useUi((s) => s.selection?.type === 'floor')
  const select = useUi((s) => s.select)

  // 施工圖在地板下方時，地板自動半透明才看得到底圖
  const spec = useMemo(() => {
    if (bp && bp.visible && bp.placement === 'under')
      return { ...floor.material, opacity: Math.max(0.12, 1 - 0.85 * bp.opacity) * (floor.material.opacity ?? 1) }
    return floor.material
  }, [floor.material, bp])

  const mat = usePBRMaterial(spec, { highlight: selected })
  const geo = useMetricFloor(floor.size[0], floor.size[1])
  const reflect = useReflectiveFloor(spec.opacity === undefined || spec.opacity >= 1)
  const onClick = (e: { stopPropagation: () => void }) => {
    if (useUi.getState().calib.active) return
    e.stopPropagation()
    select({ type: 'floor' })
  }

  if (reflect)
    return (
      <ReflectiveSurface
        mat={mat}
        w={floor.size[0]}
        d={floor.size[1]}
        position={[floor.center[0], 0, floor.center[1]]}
        resolution={512}
        onClick={onClick}
      />
    )

  return (
    <mesh
      geometry={geo}
      material={mat}
      position={[floor.center[0], 0, floor.center[1]]}
      // 地板半透明時固定在其他透明物件（格線、玻璃）之前繪製，避免排序跳動造成閃爍
      renderOrder={-1}
      receiveShadow
      onClick={(e) => {
        if (useUi.getState().calib.active) return
        e.stopPropagation()
        select({ type: 'floor' })
      }}
    />
  )
}

function ZoneView({ zone, index }: { zone: FloorZone; index: number }) {
  const mat = usePBRMaterial(zone.material)
  const geo = useMetricFloor(zone.size[0], zone.size[1])
  // 玄關磁磚也做微反射（浴室 / 陽台維持霧面）
  const reflect = useReflectiveFloor(zone.id === 'z-foyer')
  if (reflect)
    return (
      <ReflectiveSurface
        mat={mat}
        w={zone.size[0]}
        d={zone.size[1]}
        position={[zone.center[0], 0.002 + index * 0.001, zone.center[1]]}
        resolution={256}
        onClick={(e) => {
          if (useUi.getState().calib.active) return
          e.stopPropagation()
          useUi.getState().select({ type: 'zone', id: zone.id })
        }}
      />
    )
  return (
    <mesh
      geometry={geo}
      material={mat}
      // 分區彼此可能重疊（例如淋浴區疊在浴室上）：每層高 1mm，避免共平面閃爍
      position={[zone.center[0], 0.002 + index * 0.001, zone.center[1]]}
      receiveShadow
      onClick={(e) => {
        if (useUi.getState().calib.active) return
        e.stopPropagation()
        useUi.getState().select({ type: 'zone', id: zone.id })
      }}
    />
  )
}

/** 玄關落塵區、浴室、陽台等分區地板 */
export function FloorZones() {
  const zones = useLayout((s) => s.layout.floorZones)
  return <>{zones?.map((z, i) => <ZoneView key={z.id} zone={z} index={i} />)}</>
}

/** 房間以外的地面（淡色），讓地板透明時不至於露出背景 */
export function Ground() {
  const id = useLayout((s) => s.settings.lightScene ?? 'all')
  const proof = useLayout((s) => !!s.settings.colorProof)
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]}>
      <circleGeometry args={[40, 48]} />
      <meshBasicMaterial color={proof ? '#e3e8ee' : LIGHT_SCENES[id].ground} toneMapped={false} />
    </mesh>
  )
}
