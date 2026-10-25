import { Environment } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { kelvinToHex } from '../lib/color'
import { useLayout } from '../store/layoutStore'
import { ErrorBoundary } from '../ui/ErrorBoundary'

/** 色溫 → 主光顏色；Environment（apartment 預設）提供真實室內反射光 */
export function Lighting() {
  const kelvin = useLayout((s) => s.settings.kelvin)
  // 人眼/相機會自動白平衡：純黑體色溫（4000K≈#ffd1a3）直接打在白牆上會偏橘，
  // 這裡依色溫與白色混合：3000K 仍明顯偏暖、6000K 偏冷，4000K 接近中性，白牆接近色票的白。
  const color = useMemo(() => {
    const mix = kelvin <= 3000 ? 0.55 : kelvin >= 6000 ? 0.5 : 0.15
    return '#' + new THREE.Color('#ffffff').lerp(new THREE.Color(kelvinToHex(kelvin)), mix).getHexString()
  }, [kelvin])
  const warm = kelvin < 3500

  return (
    <>
      {/* apartment HDR 本身偏暖粉，用略偏冷的天光抵銷，讓 4000K 下白牆回到色票的中性白 */}
      <hemisphereLight args={[warm ? color : '#e6eeff', '#8d8a85', warm ? 0.6 : 0.75]} />
      <directionalLight
        position={[5, 11, 7]}
        color={color}
        intensity={warm ? 2.2 : 2.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={5}
      />
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <Environment preset="apartment" environmentIntensity={warm ? 0.4 : 0.32} />
        </Suspense>
      </ErrorBoundary>
    </>
  )
}
