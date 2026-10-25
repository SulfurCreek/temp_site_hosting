import { TransformControls } from '@react-three/drei'
import { useEffect, useState } from 'react'
import type * as THREE from 'three'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import { objectRegistry } from './registry'

/**
 * 位移軸 / 旋轉環（TransformControls）。拖拉時 drei 會自動停用 makeDefault 的 OrbitControls，
 * 因此手指拖拉家具不會同時轉動背景。
 */
export function Gizmo() {
  const sel = useUi((s) => s.selection)
  const moving = useUi((s) => s.moving)
  const tool = useLayout((s) => s.settings.tool)
  const snap = useLayout((s) => s.settings.snap)
  const count = useLayout((s) => s.layout.furniture.length)
  const locked = useLayout((s) => (sel?.type === 'furniture' ? s.layout.furniture.find((f) => f.id === sel.id)?.locked : false))
  const id = sel?.type === 'furniture' ? sel.id : null
  const [obj, setObj] = useState<THREE.Object3D | null>(null)

  useEffect(() => {
    setObj(id ? (objectRegistry.get(id) ?? null) : null)
  }, [id, count])

  if (!id || !obj || !moving || tool === 'drag' || locked) return null
  const rotate = tool === 'rotate'

  const commit = () => {
    const f = useLayout.getState().layout.furniture.find((x) => x.id === id)
    if (!f) return
    const r = (v: number) => Math.round(v * 1000) / 1000
    useLayout.getState().updateFurniture(id, {
      position: [r(obj.position.x), f.position[1], r(obj.position.z)],
      rotationY: Math.round((obj.rotation.y * 180) / Math.PI * 10) / 10,
    })
  }

  return (
    <TransformControls
      object={obj}
      mode={rotate ? 'rotate' : 'translate'}
      showX={!rotate}
      showY={false}
      showZ={!rotate}
      size={0.85}
      translationSnap={snap > 0 ? snap : null}
      rotationSnap={Math.PI / 12}
      onMouseDown={() => useUi.getState().setDragging(true)}
      onMouseUp={() => {
        useUi.getState().setDragging(false)
        commit()
      }}
    />
  )
}
