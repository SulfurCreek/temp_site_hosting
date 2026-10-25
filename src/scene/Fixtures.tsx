import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MEP_ITEMS } from '../data'
import type { MepItem } from '../types'

/**
 * 燈具圖的真實光源：位置全部取自 src/data/mep.json（track / ceiling / fan / downlight / strip）。
 * 每盞燈 = 發光燈具外觀（emissive，供 Bloom 擷取）+ 對應物理光源。
 */

/** 物理強度 → 畫面上看得出來的強度。正交俯視距離遠，需放大；原始規格 spot 25 / point 14 */
const GAIN = 1.8
const EMISSIVE = '#fff5e0'
const STRIP_COLOR = '#ffb46b' // 3000K 暖白

/** 軌道燈頭瞄準點（世界座標 [x, y, z]）：客廳軌道洗 275 電視牆/餐桌/沙發，次臥軌道洗西牆與沙發 */
const TRACK_AIM: Record<string, [number, number, number][]> = {
  'trk-liv': [
    [-3.95, 0.45, -0.6], // 西側沙發區
    [-0.3, 0.75, 0.45], // 圓餐桌
    [-0.45, 1.3, -0.074], // 隔間牆（洗牆光斑）
    [0.5, 1.3, -0.074],
  ],
  'trk-bed2': [
    [-4.64, 1.4, -1.9], // 西牆洗牆
    [-2.8, 0.7, -0.9], // 室內中央
    [-4.64, 1.4, 0.1],
  ],
}

/** 倍率 0 = 光源 visible=false（不計入著色器光源數）；投影點光源也受取樣器上限限制，只給三盞主燈 */
const SHADOW_POINT_IDS = new Set(['fan-liv', 'ce-master', 'ce-bed2'])

function Emissive({ k, color = EMISSIVE }: { k: number; color?: string }) {
  return (
    <meshStandardMaterial
      color="#ffffff"
      emissive={color}
      emissiveIntensity={6 * k}
      roughness={0.4}
      toneMapped
    />
  )
}

function HeadSpot({
  at,
  aim,
  k,
  color,
  shadow,
}: {
  at: [number, number, number]
  aim: [number, number, number]
  k: number
  color: string
  shadow: boolean
}) {
  const g = useRef<THREE.Group>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useLayoutEffect(() => {
    g.current?.lookAt(...aim)
  }, [aim])
  return (
    <group position={at}>
      <primitive object={target} position={[aim[0] - at[0], aim[1] - at[1], aim[2] - at[2]]} />
      <group ref={g}>
        <mesh rotation-x={Math.PI / 2} castShadow={false}>
          <cylinderGeometry args={[0.04, 0.05, 0.13, 16]} />
          <meshStandardMaterial color="#22252a" roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.066]}>
          <circleGeometry args={[0.036, 20]} />
          <Emissive k={k} />
        </mesh>
      </group>
      <spotLight
        visible={k > 0.001}
        target={target}
        color={color}
        angle={0.65}
        penumbra={0.8}
        intensity={25 * GAIN * k}
        distance={6}
        decay={2}
        castShadow={shadow}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
    </group>
  )
}

function Track({ it, k, color }: { it: MepItem; k: number; color: string }) {
  const heads = it.heads ?? 0
  const len = it.length ?? 1
  const alongZ = it.dir === 'z'
  const aims = TRACK_AIM[it.id] ?? []
  const pts = Array.from({ length: heads }, (_, i) => {
    const t = heads === 1 ? 0 : (i / (heads - 1) - 0.5) * (len - 0.3)
    return {
      at: [it.at[0] + (alongZ ? 0 : t), it.h - 0.08, it.at[1] + (alongZ ? t : 0)] as [number, number, number],
      aim: aims[i] ?? ([it.at[0], 0.4, it.at[1]] as [number, number, number]),
    }
  })
  return (
    <>
      <mesh position={[it.at[0], it.h - 0.015, it.at[1]]}>
        <boxGeometry args={[alongZ ? 0.035 : len, 0.03, alongZ ? len : 0.035]} />
        <meshStandardMaterial color="#1c1e22" roughness={0.45} metalness={0.7} />
      </mesh>
      {pts.map((p, i) => (
        // 著色器取樣器上限（多數 GPU 16 個）：只讓每條軌道的偶數燈頭投影
        <HeadSpot key={i} at={p.at} aim={p.aim} k={k} color={color} shadow={i % 2 === 0} />
      ))}
    </>
  )
}

function CeilingLamp({ it, k, color }: { it: MepItem; k: number; color: string }) {
  const d = it.diameter ?? 0.4
  const fan = it.kind === 'fan'
  const shadow = SHADOW_POINT_IDS.has(it.id)
  return (
    <group position={[it.at[0], it.h, it.at[1]]}>
      <mesh position={[0, -0.025, 0]}>
        <cylinderGeometry args={[d / 2, d / 2, 0.05, 40]} />
        <meshStandardMaterial color="#f2f0ea" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.0505, 0]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[d / 2 - 0.02, 40]} />
        <Emissive k={k} />
      </mesh>
      {fan &&
        [0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, -0.07, 0]} rotation-y={(i * Math.PI) / 2}>
            <boxGeometry args={[0.55, 0.012, 0.11]} />
            <meshStandardMaterial color="#8d7b66" roughness={0.6} />
          </mesh>
        ))}
      {/* 圓心下方 15 cm 的柔和廣角點光源 */}
      <pointLight
        visible={k > 0.001}
        position={[0, -0.15, 0]}
        color={color}
        intensity={(it.id === 'ce-bath' ? 5 : 9) * GAIN * k}
        distance={0}
        decay={1.8}
        castShadow={shadow}
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.0008}
        shadow-normalBias={0.03}
        shadow-radius={6}
      />
    </group>
  )
}

function Downlight({ it, k, color }: { it: MepItem; k: number; color: string }) {
  const target = useMemo(() => new THREE.Object3D(), [])
  return (
    <group position={[it.at[0], it.h, it.at[1]]}>
      <primitive object={target} position={[0, -it.h, 0]} />
      <mesh position={[0, -0.01, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.02, 24]} />
        <meshStandardMaterial color="#e9e7e1" roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.0205, 0]} rotation-x={Math.PI / 2}>
        <circleGeometry args={[0.04, 24]} />
        <Emissive k={k} />
      </mesh>
      <spotLight
        visible={k > 0.001}
        position={[0, -0.03, 0]}
        target={target}
        color={color}
        angle={0.85}
        penumbra={0.9}
        intensity={9 * GAIN * k}
        distance={5}
        decay={2}
      />
    </group>
  )
}

function StripLight({ it, k }: { it: MepItem; k: number }) {
  const len = it.length ?? 1
  const alongZ = it.dir === 'z'
  const off = (len / 4) as number
  return (
    <group position={[it.at[0], it.h, it.at[1]]}>
      <mesh>
        <boxGeometry args={[alongZ ? 0.02 : len, 0.015, alongZ ? len : 0.02]} />
        <Emissive k={k} color={STRIP_COLOR} />
      </mesh>
      {[-1, 1].map((s) => (
        <pointLight
          key={s}
          visible={k > 0.001}
          position={[alongZ ? 0 : s * off, -0.05, alongZ ? s * off : 0]}
          color={STRIP_COLOR}
          intensity={5 * GAIN * k}
          distance={3.5}
          decay={2}
        />
      ))}
    </group>
  )
}

/** 全部迴路開啟（固定情境）。光源總數 19、其中 7 盞投影；陰影圖只在場景變動時重算（見 lib/frameloop.ts） */
export function Fixtures({ color }: { color: string }) {
  return (
    <>
      {MEP_ITEMS.map((it) => {
        switch (it.kind) {
          case 'track':
            return <Track key={it.id} it={it} k={1} color={color} />
          case 'ceiling':
          case 'fan':
            return <CeilingLamp key={it.id} it={it} k={1} color={color} />
          case 'downlight':
            return <Downlight key={it.id} it={it} k={1} color={color} />
          case 'strip':
            return <StripLight key={it.id} it={it} k={1} />
          default:
            return null
        }
      })}
    </>
  )
}
