import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import * as THREE from 'three'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import { BlueprintPlane, CalibrationLayer } from './Blueprint'
import { CameraRig } from './CameraRig'
import { Ceiling, FirstPersonRig, PlacementLayer } from './FirstPerson'
import { Floor, FloorZones, Ground } from './Floor'
import { FurnitureLayer } from './Furniture'
import { Gizmo } from './Gizmo'
import { MepLayer } from './Mep'
import { Lighting } from './Lighting'
import { Walls } from './Walls'

function GridLines() {
  const showGrid = useLayout((s) => s.settings.showGrid)
  const iso = useUi((s) => s.viewMode) === 'isometric'
  const show = showGrid && iso
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
      renderOrder={1}
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
  const fp = useUi((s) => s.viewMode) === 'firstPerson'
  return (
    <Canvas
      shadows="percentage"
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      // Khronos PBR Neutral tone mapping：保留材質原本的色相/明度（ACES 會讓白牆偏黃、色碼失真）
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping
        gl.toneMappingExposure = 1.08
      }}
      onPointerMissed={() => {
        if (useUi.getState().calib.active) return
        useUi.getState().select(null)
      }}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#e8ecf1']} />
      <CameraRig />
      {fp && <FirstPersonRig />}
      {import.meta.env.DEV && <DevProbe />}
      <Lighting />
      <Suspense fallback={null}>
        <Ground />
        <BlueprintPlane />
        <Floor />
        <FloorZones />
        <Walls />
        {fp && <Ceiling />}
        <PlacementLayer />
        <FurnitureLayer />
        <GridLines />
        {!fp && <Gizmo />}
        <MepLayer />
        <CalibrationLayer />
      </Suspense>
    </Canvas>
  )
}
