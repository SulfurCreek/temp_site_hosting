import { useFrame, useThree } from '@react-three/fiber'
import { DepthOfField } from '@react-three/postprocessing'
import type { DepthOfFieldEffect } from 'postprocessing'
import { useRef } from 'react'
import * as THREE from 'three'

function isVisible(o: THREE.Object3D | null) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false
  return true
}

/**
 * 第一人稱光學景深：每 ~80 ms 從畫面正中央發射 Raycaster，取最近的牆 / 家具距離當對焦距離，
 * 再平滑追焦。放進 <PostFX> 的 children（EffectComposer 內，AO 之後、Bloom 之前）。
 */
export function DepthOfFieldFx() {
  const fx = useRef<DepthOfFieldEffect>(null)
  const ray = useRef(new THREE.Raycaster())
  const focus = useRef(3)
  const wanted = useRef(3)
  const last = useRef(0)
  const center = useRef(new THREE.Vector2(0, 0))
  const scene = useThree((s) => s.scene)

  useFrame(({ camera, clock }, dt) => {
    const e = fx.current
    if (!e) return
    const now = clock.elapsedTime
    if (now - last.current > 0.08) {
      last.current = now
      ray.current.setFromCamera(center.current, camera)
      let d = 8
      for (const h of ray.current.intersectObjects(scene.children, true)) {
        const o = h.object as THREE.Mesh
        if (!o.isMesh || o.userData.noPick || !isVisible(o)) continue
        const m = o.material as THREE.Material | THREE.Material[]
        if (!Array.isArray(m) && (m.visible === false || (m.transparent && m.opacity < 0.3))) continue
        d = h.distance
        break
      }
      wanted.current = THREE.MathUtils.clamp(d, 0.4, 12)
    }
    focus.current = THREE.MathUtils.damp(focus.current, wanted.current, 6, dt)
    const mat = e.circleOfConfusionMaterial
    mat.worldFocusDistance = focus.current
    // 對焦範圍隨距離放大，近處景深淺、遠處較深，避免整個房間都糊掉
    mat.worldFocusRange = Math.max(2.5, focus.current * 1.5)
  })

  return <DepthOfField ref={fx} worldFocusDistance={3} worldFocusRange={3} bokehScale={1.8} resolutionScale={0.5} />
}
