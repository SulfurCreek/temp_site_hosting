import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Wall } from '../types'

const BASE_H = 0.08 // 踢腳線高
const BASE_T = 0.012
const CURTAIN_H = 0.14 // 窗簾盒高
const CURTAIN_D = 0.16
const TRIM_MAT = new THREE.MeshStandardMaterial({ color: '#f3f1ec', roughness: 0.55, metalness: 0 })

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new RoundedBoxGeometry(w, h, d, 1, Math.min(0.003, Math.min(w, h, d) * 0.45))
  g.translate(x, y, z)
  return g
}

/**
 * 牆的踢腳線（兩面，避開門洞）與窗簾盒（外牆有窗時，沿窗範圍貼天花板）。
 * 放在 WallView 的群組內（牆的本地座標：x 沿牆中心線、原點在牆中點），
 * 因此會跟著牆一起淡出 / 隱藏；牆被降低或半透明時自動隱藏。
 */
export function WallTrim({
  wall,
  len,
  interiorSign,
  heightRef,
  wallMat,
}: {
  wall: Wall
  len: number
  /** 本地 +z 是否朝室內（+1）或朝外（-1） */
  interiorSign: 1 | -1
  heightRef: { current: number }
  wallMat: THREE.Material
}) {
  const base = useRef<THREE.Mesh>(null)
  const curtain = useRef<THREE.Mesh>(null)

  const { baseGeo, curtainGeo } = useMemo(() => {
    if (wall.thickness < 0.05 || wall.height < 2.2) return { baseGeo: null, curtainGeo: null }
    // 踢腳線：沿牆長扣掉門洞
    const doors = wall.openings
      .filter((o) => o.type === 'door' && o.sill < 0.3)
      .map((o) => [o.at - o.width / 2, o.at + o.width / 2] as const)
      .sort((a, b) => a[0] - b[0])
    const spans: [number, number][] = []
    let c = 0
    for (const [a, b] of doors) {
      if (a - c > 0.05) spans.push([c, a])
      c = Math.max(c, b)
    }
    if (len - c > 0.05) spans.push([c, len])
    const baseParts: THREE.BufferGeometry[] = []
    for (const side of [-1, 1]) {
      const z = side * (wall.thickness / 2 + BASE_T / 2)
      for (const [a, b] of spans) baseParts.push(box(b - a, BASE_H, BASE_T, (a + b) / 2 - len / 2, BASE_H / 2, z))
    }
    // 窗簾盒：只在室內側，涵蓋窗戶範圍（兩側各多 10 cm）
    const wins = wall.openings.filter((o) => o.type === 'window')
    let cg: THREE.BufferGeometry | null = null
    if (wall.exterior && wins.length) {
      const a = Math.max(0, Math.min(...wins.map((o) => o.at - o.width / 2)) - 0.1)
      const b = Math.min(len, Math.max(...wins.map((o) => o.at + o.width / 2)) + 0.1)
      const top = wall.height
      const sillTop = Math.max(...wins.map((o) => o.sill + o.height))
      if (top - CURTAIN_H > sillTop) {
        cg = box(b - a, CURTAIN_H, CURTAIN_D, (a + b) / 2 - len / 2, top - CURTAIN_H / 2, interiorSign * (wall.thickness / 2 + CURTAIN_D / 2))
      }
    }
    // 踢腳線的 side 是「本地 z」，兩面都做，不需要 interiorSign
    return { baseGeo: baseParts.length ? mergeGeometries(baseParts) : null, curtainGeo: cg }
  }, [wall, len, interiorSign])

  useEffect(() => () => {
    baseGeo?.dispose()
    curtainGeo?.dispose()
  }, [baseGeo, curtainGeo])

  useFrame(() => {
    const solid = wallMat.opacity > 0.95
    if (base.current) base.current.visible = solid
    if (curtain.current) curtain.current.visible = solid && heightRef.current >= wall.height - 0.005
  })

  return (
    <>
      {baseGeo && <mesh ref={base} geometry={baseGeo} material={TRIM_MAT} castShadow receiveShadow />}
      {curtainGeo && <mesh ref={curtain} geometry={curtainGeo} material={TRIM_MAT} castShadow receiveShadow />}
    </>
  )
}
