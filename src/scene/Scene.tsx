import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import { BlueprintPlane, CalibrationLayer } from './Blueprint'
import { CameraRig } from './CameraRig'
import { Floor, FloorZones, Ground } from './Floor'
import { FurnitureLayer } from './Furniture'
import { Gizmo } from './Gizmo'
import { MepLayer } from './Mep'
import { Lighting } from './Lighting'
import { Walls } from './Walls'

function GridLines() {
  const show = useLayout((s) => s.settings.showGrid)
  const floor = useLayout((s) => s.layout.floor)
  if (!show) return null
  const size = Math.ceil(Math.max(floor.size[0], floor.size[1]) / 0.5) * 0.5 + 1
  return (
    <gridHelper
      args={[size, Math.round(size / 0.5), '#64748b', '#94a3b8']}
      position={[floor.center[0], 0.003, floor.center[1]]}
      material-transparent
      material-opacity={0.22}
      material-depthWrite={false}
    />
  )
}

/** 開發模式：把 R3F state getter 掛到 window.__r3f 供除錯 */
function DevProbe() {
  const get = useThree((s) => s.get)
  useEffect(() => {
    ;(window as unknown as { __r3f: unknown }).__r3f = get
  }, [get])
  return null
}

export function Scene() {
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => {
        if (useUi.getState().calib.active) return
        useUi.getState().select(null)
      }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#e8ecf1']} />
      <CameraRig />
      {import.meta.env.DEV && <DevProbe />}
      <Lighting />
      <Suspense fallback={null}>
        <Ground />
        <BlueprintPlane />
        <Floor />
        <FloorZones />
        <Walls />
        <FurnitureLayer />
        <GridLines />
        <Gizmo />
        <MepLayer />
        <CalibrationLayer />
      </Suspense>
    </Canvas>
  )
}
