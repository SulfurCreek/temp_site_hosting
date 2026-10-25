import type { Archetype, MaterialSpec } from '../types'

/** 物理基底預設值。MaterialSpec 明確填的欄位優先，沒填的才用這裡。 */
export interface ArchetypeDef {
  id: Archetype
  label: string
  note: string
  roughness: number
  metalness: number
  clearcoat: number
  clearcoatRoughness: number
  /** 0..1，MeshPhysicalMaterial.reflectivity（0.5 ≈ IOR 1.5） */
  reflectivity: number
  /** 法線強度（normalScale） */
  bumpScale: number
  /** 微紋理一張涵蓋的公尺數；follow = 跟著 albedo 貼圖同比例（拼縫/填縫對位） */
  tileMeters: number | 'follow'
}

export const ARCHETYPES: Record<Archetype, ArchetypeDef> = {
  paint_eggshell: {
    id: 'paint_eggshell',
    label: '乳膠漆（蛋殼/平光）',
    note: '滾塗顆粒',
    roughness: 0.72,
    metalness: 0,
    clearcoat: 0.05,
    clearcoatRoughness: 0.5,
    reflectivity: 0.5,
    bumpScale: 0.35,
    tileMeters: 0.25,
  },
  egger_st9: {
    id: 'egger_st9',
    label: 'EGGER ST9 柔霧面',
    note: '平滑無木紋、柔霧漫反射',
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0,
    clearcoatRoughness: 0.5,
    reflectivity: 0.3,
    bumpScale: 0.2,
    tileMeters: 0.2,
  },
  egger_st19: {
    id: 'egger_st19',
    label: 'EGGER ST19 深壓紋消光',
    note: '直向細木紋壓痕，斜光可見',
    roughness: 0.62,
    metalness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.6,
    reflectivity: 0.5,
    bumpScale: 0.4,
    tileMeters: 0.5,
  },
  laminate_wood: {
    id: 'laminate_wood',
    label: '超耐磨木地板',
    note: '板材拼縫 + 耐磨層反光',
    roughness: 0.45,
    metalness: 0,
    clearcoat: 0.15,
    clearcoatRoughness: 0.4,
    reflectivity: 0.5,
    bumpScale: 0.8,
    tileMeters: 'follow',
  },
  matte_tile: {
    id: 'matte_tile',
    label: '霧面石英磚',
    note: '填縫 + 微石材顆粒',
    roughness: 0.5,
    metalness: 0.05,
    clearcoat: 0,
    clearcoatRoughness: 0.5,
    reflectivity: 0.5,
    bumpScale: 0.9,
    tileMeters: 'follow',
  },
}

export const ARCHETYPE_LIST = Object.values(ARCHETYPES)

/** 切換基底時要寫入 MaterialSpec 的欄位（color / map / repeat 不動） */
export function archetypePatch(id: Archetype): Partial<MaterialSpec> {
  const a = ARCHETYPES[id]
  return {
    archetype: id,
    roughness: a.roughness,
    metalness: a.metalness,
    clearcoat: a.clearcoat,
    clearcoatRoughness: a.clearcoatRoughness,
    reflectivity: a.reflectivity,
    bumpScale: a.bumpScale,
  }
}
