import type { LightScene } from '../types'

export interface LightSceneDef {
  id: LightScene
  label: string
  title: string
  /** AmbientLight 強度（取代過去過強的假環境光） */
  ambient: number
  /** Environment（只負責反射與微量天光）強度 */
  env: number
  /** 各迴路亮度倍率 0..1（對應開關圖：軌道 / 吸頂+吊扇 / 嵌燈 / 燈條） */
  on: { track: number; ceiling: number; downlight: number; strip: number }
  /** 個別燈具覆寫（覆蓋 on 的群組倍率），例如夜燈只留玄關嵌燈 */
  only?: Record<string, number>
  sun?: { position: [number, number, number]; color: string; intensity: number }
  moon?: { position: [number, number, number]; color: string; intensity: number }
  bg: string
  ground: string
}

export const LIGHT_SCENES: Record<LightScene, LightSceneDef> = {
  all: {
    id: 'all',
    label: '全開',
    title: '全部迴路開啟：軌道燈、吸頂燈、吊扇燈、嵌燈、燈條',
    ambient: 0.1,
    env: 0.08,
    on: { track: 1, ceiling: 1, downlight: 1, strip: 1 },
    bg: '#e8ecf1',
    ground: '#e3e8ee',
  },
  track: {
    id: 'track',
    label: '軌道',
    title: '僅開氛圍軌道燈（客廳 4 燈頭 + 次臥 3 燈頭）與玄關燈條',
    ambient: 0.06,
    env: 0.04,
    on: { track: 1, ceiling: 0, downlight: 0, strip: 1 },
    bg: '#cfd5de',
    ground: '#c9cfd8',
  },
  night: {
    id: 'night',
    label: '夜燈',
    title: '夜燈模式：玄關燈條與玄關嵌燈低亮度，淡淡月光',
    ambient: 0.08,
    env: 0.03,
    on: { track: 0, ceiling: 0, downlight: 0, strip: 0.7 },
    only: { 'dl-entry': 0.3 },
    moon: { position: [-6, 9, -5], color: '#8fa8ff', intensity: 0.45 },
    bg: '#0f1420',
    ground: '#151b28',
  },
  day: {
    id: 'day',
    label: '日光',
    title: '白天自然光：陽光從主臥窗與廚房 DW1 落地窗打入，燈具全關',
    ambient: 0.32,
    env: 0.35,
    on: { track: 0, ceiling: 0, downlight: 0, strip: 0 },
    sun: { position: [10, 6.5, -2.5], color: '#fff1d8', intensity: 3.0 },
    bg: '#e8ecf1',
    ground: '#e3e8ee',
  },
}

export const LIGHT_SCENE_LIST = Object.values(LIGHT_SCENES)
