import { useMemo } from 'react'
import * as THREE from 'three'
import { MEP_ITEMS } from '../data'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import type { MepItem, MepKind } from '../types'

export const MEP_COLOR: Record<MepKind, string> = {
  outlet: '#ef4444',
  dedicated: '#f97316',
  weak: '#22c55e',
  switch: '#3b82f6',
  water: '#06b6d4',
  track: '#facc15',
  ceiling: '#fde047',
  fan: '#fde047',
  downlight: '#fef08a',
  strip: '#facc15',
}

export const MEP_KIND_LABEL: Record<MepKind, string> = {
  outlet: '110V 插座',
  dedicated: '專用迴路插座',
  weak: '弱電 / 網路 / TV',
  switch: '開關',
  water: '給排水',
  track: '軌道燈',
  ceiling: '吸頂燈',
  fan: '吊扇燈',
  downlight: '嵌燈',
  strip: '燈條',
}

const NORMAL: Record<'N' | 'S' | 'E' | 'W', [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }

/** 牆面標記：貼在牆面上，朝向室內，離地 h 公尺 */
function WallMarker({ it, active }: { it: MepItem; active: boolean }) {
  const n = NORMAL[it.face ?? 'N']
  const rotY = Math.atan2(n[0], n[1]) // 讓 +Z 指向牆面法線（室內方向）
  const color = MEP_COLOR[it.kind]
  const square = it.kind === 'switch'
  return (
    <group position={[it.at[0] + n[0] * 0.012, it.h, it.at[1] + n[1] * 0.012]} rotation-y={rotY}>
      <mesh rotation-x={Math.PI / 2} renderOrder={900}>
        {square ? <boxGeometry args={[0.09, 0.02, 0.09]} /> : <cylinderGeometry args={[0.05, 0.05, 0.02, 24]} />}
        <meshBasicMaterial color={color} depthTest={false} transparent opacity={active ? 1 : 0.9} />
      </mesh>
      {it.kind === 'dedicated' && (
        <mesh rotation-x={Math.PI / 2} renderOrder={899}>
          <torusGeometry args={[0.075, 0.01, 8, 24]} />
          <meshBasicMaterial color={color} depthTest={false} />
        </mesh>
      )}
      {active && (
        <mesh renderOrder={901}>
          <sphereGeometry args={[0.11, 16, 12]} />
          <meshBasicMaterial color="#ffffff" depthTest={false} transparent opacity={0.25} />
        </mesh>
      )}
    </group>
  )
}

function CeilingMarker({ it, active }: { it: MepItem; active: boolean }) {
  const color = MEP_COLOR[it.kind]
  const heads = it.heads ?? 0
  const len = it.length ?? 1
  const along = it.dir === 'z' ? ([0, 0, 1] as const) : ([1, 0, 0] as const)
  const stripGeo = useMemo(() => new THREE.BoxGeometry(it.dir === 'z' ? 0.04 : len, 0.03, it.dir === 'z' ? len : 0.04), [it.dir, len])
  const pad = (v: number) => v
  if (it.kind === 'track' || it.kind === 'strip')
    return (
      <group position={[it.at[0], it.h, it.at[1]]}>
        <mesh geometry={stripGeo} renderOrder={900}>
          <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.9} />
        </mesh>
        {Array.from({ length: heads }, (_, i) => {
          const t = heads === 1 ? 0 : (i / (heads - 1) - 0.5) * (len - 0.3)
          return (
            <mesh key={i} position={[along[0] * pad(t), -0.1, along[2] * pad(t)]} rotation={[0.6, 0, 0]} renderOrder={900}>
              <coneGeometry args={[0.055, 0.14, 12]} />
              <meshBasicMaterial color={color} depthTest={false} />
            </mesh>
          )
        })}
        {active && <mesh renderOrder={901}><sphereGeometry args={[Math.max(0.2, len / 2), 16, 12]} /><meshBasicMaterial color="#fff" transparent opacity={0.12} depthTest={false} /></mesh>}
      </group>
    )
  const d = it.diameter ?? 0.15
  return (
    <group position={[it.at[0], it.h, it.at[1]]}>
      <mesh rotation-x={Math.PI / 2} renderOrder={900}>
        {it.kind === 'downlight' ? <circleGeometry args={[0.05, 20]} /> : <ringGeometry args={[d / 2 - 0.02, d / 2, 40]} />}
        <meshBasicMaterial color={color} depthTest={false} side={THREE.DoubleSide} />
      </mesh>
      {it.kind === 'fan' &&
        [0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, -0.02, 0]} rotation-y={(i * Math.PI) / 2} renderOrder={900}>
            <boxGeometry args={[d, 0.01, 0.05]} />
            <meshBasicMaterial color={color} depthTest={false} />
          </mesh>
        ))}
      {active && <mesh renderOrder={901}><sphereGeometry args={[Math.max(0.15, d / 2 + 0.05), 16, 12]} /><meshBasicMaterial color="#fff" transparent opacity={0.2} depthTest={false} /></mesh>}
    </group>
  )
}

/** 水電 / 燈具標記圖層（MEP View）。點擊標記可在畫面上看資訊。 */
export function MepLayer() {
  const show = useLayout((s) => s.settings.showMep)
  const activeId = useUi((s) => s.mepId)
  if (!show) return null
  return (
    <group>
      {MEP_ITEMS.map((it) => {
        const ceiling = !it.face
        return (
          <group
            key={it.id}
            onClick={(e) => {
              e.stopPropagation()
              useUi.getState().selectMep(it.id)
            }}
            onPointerOver={() => (document.body.style.cursor = 'pointer')}
            onPointerOut={() => (document.body.style.cursor = '')}
          >
            {ceiling ? <CeilingMarker it={it} active={activeId === it.id} /> : <WallMarker it={it} active={activeId === it.id} />}
            {/* 較大的透明點擊區，手機好點 */}
            <mesh position={[it.at[0], ceiling ? it.h : it.h, it.at[1]]}>
              <sphereGeometry args={[0.16, 8, 6]} />
              <meshBasicMaterial visible={false} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
