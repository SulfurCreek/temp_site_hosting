import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { MaterialSpec } from '../types'
import { loadBaseTexture } from './textures'

export const PAINT_FINISHES = [
  { id: 'flat', label: '平光', roughness: 0.95 },
  { id: 'eggshell', label: '蛋殼光', roughness: 0.6 },
  { id: 'gloss', label: '亮光', roughness: 0.25 },
] as const

export const DEFAULT_MATERIAL: MaterialSpec = { color: '#d9d4c7', roughness: 0.8, metalness: 0 }

interface Opts {
  /** 選取高亮（emissive 微光） */
  highlight?: boolean
  side?: THREE.Side
}

/**
 * 依 MaterialSpec 建立並同步一個 MeshStandardMaterial。
 * 貼圖非同步載入；失敗時退回純色。回傳的 material 可被呼叫端在 useFrame 中直接改 opacity（破牆用）。
 */
export function usePBRMaterial(spec: MaterialSpec, opts: Opts = {}) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial(), [])
  const [tex, setTex] = useState<THREE.Texture | null>(null)

  useEffect(() => () => mat.dispose(), [mat])

  useEffect(() => {
    if (!spec.map) {
      setTex(null)
      return
    }
    let alive = true
    let clone: THREE.Texture | null = null
    loadBaseTexture(spec.map)
      .then((base) => {
        if (!alive) return
        clone = base.clone()
        clone.needsUpdate = true
        setTex(clone)
      })
      .catch((e) => {
        console.warn('[texture]', e.message)
        if (alive) setTex(null)
      })
    return () => {
      alive = false
      clone?.dispose()
    }
  }, [spec.map])

  useEffect(() => {
    mat.color.set(spec.color)
    mat.roughness = spec.roughness
    mat.metalness = spec.metalness
    const op = spec.opacity ?? 1
    mat.opacity = op
    mat.transparent = op < 1
    mat.side = opts.side ?? THREE.FrontSide
    if (tex) {
      const r = spec.repeat ?? 1
      tex.repeat.set(r, r)
    }
    mat.map = tex
    if (opts.highlight) {
      mat.emissive.set('#3b82f6')
      mat.emissiveIntensity = 0.22
    } else {
      mat.emissive.set('#000000')
      mat.emissiveIntensity = 0
    }
    mat.needsUpdate = true
  }, [mat, spec, tex, opts.highlight, opts.side])

  return mat
}

/** 把油漆的 roughness 反查成 平光/蛋殼光/亮光 */
export function finishOf(roughness: number) {
  let best: (typeof PAINT_FINISHES)[number] = PAINT_FINISHES[0]
  for (const f of PAINT_FINISHES) if (Math.abs(f.roughness - roughness) < Math.abs(best.roughness - roughness)) best = f
  return Math.abs(best.roughness - roughness) < 0.08 ? best.id : null
}
