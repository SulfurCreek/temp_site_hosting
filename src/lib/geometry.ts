import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

/**
 * 每個面的 UV 以「實際公尺數」縮放：貼圖 repeat = 每公尺重複次數，
 * 因此任何尺寸的牆面/地板/家具，紋理比例都一致，不會被拉伸。
 */
export function makeMetricBox(w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  // BoxGeometry 面順序：+x, -x, +y, -y, +z, -z，每面 4 頂點
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]
  for (let f = 0; f < 6; f++)
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i
      uv.setXY(k, uv.getX(k) * dims[f][0], uv.getY(k) * dims[f][1])
    }
  uv.needsUpdate = true
  return g
}

/** 水平地板（朝上），UV 以公尺計 */
export function makeMetricFloor(w: number, d: number) {
  const g = new THREE.PlaneGeometry(w, d)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * d)
  g.rotateX(-Math.PI / 2)
  return g
}

export function useMetricBox(w: number, h: number, d: number) {
  const g = useMemo(() => makeMetricBox(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001)), [w, h, d])
  useEffect(() => () => g.dispose(), [g])
  return g
}

export function useMetricFloor(w: number, d: number) {
  const g = useMemo(() => makeMetricFloor(Math.max(w, 0.01), Math.max(d, 0.01)), [w, d])
  useEffect(() => () => g.dispose(), [g])
  return g
}
