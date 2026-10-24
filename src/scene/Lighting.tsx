import { Environment } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import { kelvinToHex } from '../lib/color'
import { useLayout } from '../store/layoutStore'
import { ErrorBoundary } from '../ui/ErrorBoundary'

/** 色溫 → 主光顏色；Environment（apartment 預設）提供真實室內反射光 */
export function Lighting() {
  const kelvin = useLayout((s) => s.settings.kelvin)
  const color = useMemo(() => kelvinToHex(kelvin), [kelvin])
  const warm = kelvin < 3500

  return (
    <>
      <hemisphereLight args={[color, '#8d8a85', warm ? 0.5 : 0.35]} />
      <directionalLight
        position={[5, 11, 7]}
        color={color}
        intensity={warm ? 2.0 : 2.4}
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
          <Environment preset="apartment" environmentIntensity={warm ? 0.55 : 0.7} />
        </Suspense>
      </ErrorBoundary>
    </>
  )
}
