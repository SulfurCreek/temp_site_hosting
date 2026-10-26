import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import type { MaterialSpec } from '../types'
import { ARCHETYPES } from './archetypes'
import { ROUGH_MEAN, getDerivedMicro, getStandaloneMicro } from './microTextures'
import { ARCHETYPE_PBR, PBR_SETS, loadPbrSet, type LoadedPbr } from './pbrTextures'
import { loadBaseTexture, sharedClone } from './textures'

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

interface MicroTex {
  normal: THREE.Texture
  rough: THREE.Texture
  /** 每公尺重複幾次；null = 跟著 albedo 的 repeat */
  perMeter: number | null
}

interface ScanTex {
  set: LoadedPbr['set']
  albedo?: THREE.Texture
  normal?: THREE.Texture
  rough?: THREE.Texture
  roughMean: number
  all: THREE.Texture[]
}

/** 每個材質各自 clone（repeat 不互相影響；底層 image 共用，GPU 只上傳一次） */
function cloneScan(l: LoadedPbr): ScanTex {
  const c = (t?: THREE.Texture) => (t ? sharedClone(t) : undefined)
  const albedo = c(l.albedo)
  const normal = c(l.normal)
  const rough = c(l.rough)
  return {
    set: l.set,
    albedo,
    normal,
    rough,
    roughMean: l.roughMean,
    all: [albedo, normal, rough].filter((t): t is THREE.Texture => !!t),
  }
}

/** 同一張 canvas 只建立一個基底貼圖；各材質拿到的是共用 GPU 記憶體的 clone（原本每個材質各上傳一份） */
const microBase = new WeakMap<HTMLCanvasElement, THREE.CanvasTexture>()
function microTexture(cv: HTMLCanvasElement, color: boolean) {
  let t = microBase.get(cv)
  if (!t) {
    t = new THREE.CanvasTexture(cv)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.anisotropy = 8
    microBase.set(cv, t)
  }
  return sharedClone(t)
}

/**
 * 依 MaterialSpec 建立並同步一個 MeshPhysicalMaterial。
 * 有 archetype 時：套用該基底的 clearcoat / reflectivity 預設，並生成程序化 Normal + Roughness 微紋理。
 * 貼圖非同步載入；失敗時退回純色。回傳的 material 可被呼叫端在 useFrame 中直接改 opacity（破牆用）。
 */
export function usePBRMaterial(spec: MaterialSpec, opts: Opts = {}) {
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial(), [])
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  const [micro, setMicro] = useState<MicroTex | null>(null)
  const [scan, setScan] = useState<ScanTex | null>(null)

  useEffect(() => () => mat.dispose(), [mat])

  // 真實 PBR 掃描貼圖（lazy）：載入前用內建/程序化貼圖，載入後取代
  const pbrSlug = spec.pbr === false ? undefined : (spec.pbr ?? (spec.archetype ? ARCHETYPE_PBR[spec.archetype] : undefined))
  useEffect(() => {
    if (!pbrSlug || !PBR_SETS[pbrSlug]) {
      setScan(null)
      return
    }
    let alive = true
    let made: ScanTex | null = null
    loadPbrSet(pbrSlug)
      .then((l) => {
        if (!alive) return
        made = cloneScan(l)
        setScan(made)
      })
      .catch((e) => {
        console.warn('[pbr]', e.message)
        if (alive) setScan(null)
      })
    return () => {
      alive = false
      made?.all.forEach((t) => t.dispose())
    }
  }, [pbrSlug])

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
        clone = sharedClone(base)
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

  // 程序化微紋理（依 archetype；laminate_wood / matte_tile 需等 albedo 載入後由其導出）
  useEffect(() => {
    const a = spec.archetype
    if (!a || !ARCHETYPES[a] || spec.bumpScale === 0 || (scan?.normal && scan.rough)) {
      setMicro(null)
      return
    }
    let maps: { normal: HTMLCanvasElement; rough: HTMLCanvasElement } | null = null
    let perMeter: number | null = null
    if (a === 'paint_eggshell' || a === 'egger_st9' || a === 'egger_st19' || a === 'fabric_scratch') {
      maps = getStandaloneMicro(a)
      perMeter = 1 / (ARCHETYPES[a].tileMeters as number)
    } else if (tex?.image) {
      maps = getDerivedMicro(a, spec.map ?? '', tex.image as CanvasImageSource)
    }
    if (!maps) {
      setMicro(null)
      return
    }
    const m: MicroTex = { normal: microTexture(maps.normal, false), rough: microTexture(maps.rough, false), perMeter }
    setMicro(m)
    return () => {
      m.normal.dispose()
      m.rough.dispose()
    }
  }, [spec.archetype, spec.bumpScale, spec.map, tex, scan])

  useEffect(() => {
    const def = spec.archetype ? ARCHETYPES[spec.archetype] : undefined
    mat.color.set(spec.color)
    mat.roughness = Math.min(1, spec.roughness / (scan?.rough ? scan.roughMean : micro ? ROUGH_MEAN : 1))
    mat.metalness = spec.metalness
    mat.clearcoat = spec.clearcoat ?? def?.clearcoat ?? 0
    mat.clearcoatRoughness = spec.clearcoatRoughness ?? def?.clearcoatRoughness ?? 0.5
    mat.reflectivity = spec.reflectivity ?? def?.reflectivity ?? 0.5
    const op = spec.opacity ?? 1
    mat.opacity = op
    mat.transparent = op < 1
    mat.side = opts.side ?? THREE.FrontSide
    const r = spec.repeat ?? 1
    if (tex) tex.repeat.set(r, r)
    // 掃描貼圖：repeat 1 = 真實尺寸（每張涵蓋 set.meters 公尺）；有 albedo 時取代 spec.map
    const sr = scan ? r / scan.set.meters : r
    if (scan) for (const t of scan.all) t.repeat.set(sr, sr)
    mat.map = scan?.albedo ?? tex
    if (scan?.normal && scan.rough) {
      const bs = spec.bumpScale ?? def?.bumpScale ?? 0.5
      mat.normalMap = scan.normal
      mat.normalScale.set(bs, bs)
      mat.roughnessMap = scan.rough
    } else if (micro) {
      const mr = micro.perMeter ?? r
      micro.normal.repeat.set(mr, mr)
      micro.rough.repeat.set(mr, mr)
      const bs = spec.bumpScale ?? def?.bumpScale ?? 0.5
      mat.normalMap = micro.normal
      mat.normalScale.set(bs, bs)
      mat.roughnessMap = micro.rough
    } else {
      mat.normalMap = null
      mat.roughnessMap = null
    }
    if (opts.highlight) {
      mat.emissive.set('#3b82f6')
      mat.emissiveIntensity = 0.22
    } else {
      mat.emissive.set('#000000')
      mat.emissiveIntensity = 0
    }
    mat.needsUpdate = true
  }, [mat, spec, tex, micro, scan, opts.highlight, opts.side])

  return mat
}

/** 把油漆的 roughness 反查成 平光/蛋殼光/亮光 */
export function finishOf(roughness: number) {
  let best: (typeof PAINT_FINISHES)[number] = PAINT_FINISHES[0]
  for (const f of PAINT_FINISHES) if (Math.abs(f.roughness - roughness) < Math.abs(best.roughness - roughness)) best = f
  return Math.abs(best.roughness - roughness) < 0.08 ? best.id : null
}
