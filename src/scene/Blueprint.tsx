import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { loadBaseTexture } from '../lib/textures'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'

/** 平面施工圖描圖層。放在地板下方（y = -0.01）或疊在地板上（y = 0.004）。 */
export function BlueprintPlane() {
  const bp = useLayout((s) => s.layout.blueprint)
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  const activeUrl = bp ? (bp.layers?.find((l) => l.id === bp.layerId)?.url ?? bp.url) : ''

  useEffect(() => {
    if (!activeUrl) {
      setTex(null)
      return
    }
    let alive = true
    loadBaseTexture(activeUrl)
      .then((t) => alive && setTex(t))
      .catch(() => {
        if (alive) setTex(null)
        useUi.getState().showToast('施工圖載入失敗：' + activeUrl.slice(0, 60))
      })
    return () => {
      alive = false
    }
  }, [activeUrl])

  const aspect = useMemo(() => {
    const img = tex?.image as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number } | undefined
    const w = img?.naturalWidth || img?.width || 1
    const h = img?.naturalHeight || img?.height || 1
    return w / h
  }, [tex])

  if (!bp || !bp.visible || !tex) return null
  const w = bp.widthMeters
  const h = w / aspect
  const y = bp.placement === 'under' ? -0.012 : 0.004
  return (
    <group position={[bp.offset[0], y, bp.offset[1]]} rotation-y={THREE.MathUtils.degToRad(bp.rotation)}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={-1}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial
          map={tex}
          transparent
          opacity={bp.opacity}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* 圖片外框，校準時看得出實際範圍 */}
      <Outline w={w} h={h} />
    </group>
  )
}

function Outline({ w, h }: { w: number; h: number }) {
  const geo = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, h)), [w, h])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <lineSegments rotation-x={-Math.PI / 2} geometry={geo}>
      <lineBasicMaterial color="#0ea5e9" transparent opacity={0.5} />
    </lineSegments>
  )
}

/** 兩點比例尺校準：攔截點擊並顯示量測點 */
export function CalibrationLayer() {
  const calib = useUi((s) => s.calib)
  const add = useUi((s) => s.addCalibPoint)
  if (!calib.active) return null
  const [a, b] = calib.points
  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0.02, 0]}
        onClick={(e) => {
          e.stopPropagation()
          add([e.point.x, e.point.z])
        }}
      >
        <planeGeometry args={[60, 60]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {calib.points.map((p, i) => (
        <mesh key={i} position={[p[0], 0.05, p[1]]} renderOrder={999}>
          <sphereGeometry args={[0.06, 16, 12]} />
          <meshBasicMaterial color={i === 0 ? '#f97316' : '#22c55e'} depthTest={false} />
        </mesh>
      ))}
      {a && b && <CalibLine a={a} b={b} />}
    </group>
  )
}

function CalibLine({ a, b }: { a: [number, number]; b: [number, number] }) {
  const obj = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(a[0], 0.05, a[1]),
      new THREE.Vector3(b[0], 0.05, b[1]),
    ])
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#f97316', depthTest: false }))
    l.renderOrder = 998
    return l
  }, [a, b])
  useEffect(
    () => () => {
      obj.geometry.dispose()
      ;(obj.material as THREE.Material).dispose()
    },
    [obj],
  )
  return <primitive object={obj} />
}
