import { useMemo } from 'react'
import type { FloorZone } from '../types'
import { useMetricFloor } from '../lib/geometry'
import { usePBRMaterial } from '../lib/materials'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'

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
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.03, 0]}>
      <circleGeometry args={[40, 48]} />
      <meshBasicMaterial color="#e3e8ee" toneMapped={false} />
    </mesh>
  )
}
