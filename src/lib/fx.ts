import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import { useMediaQuery } from '../ui/hooks'

export type FxTier = 'high' | 'medium' | 'low'

/**
 * 後期渲染品質：
 * high（桌面）= N8AO 高品質 + 地板反射 + 聚光/點光陰影 + Bloom；
 * medium = 半解析度 AO + Bloom，無反射、少量陰影；
 * low（手機 < 768px 預設）= 不掛 EffectComposer、無反射/AO、燈具不投影，僅用 ACES 色調映射。
 */
export function useFxTier(): FxTier {
  const pref = useLayout((s) => s.settings.fxQuality ?? 'auto')
  const small = useMediaQuery('(max-width: 767px)')
  // 相片級算圖模式：靜態檢視，手機也升到 high
  if (useUi((s) => s.studio)) return 'high'
  if (pref === 'auto') return small ? 'low' : 'high'
  return pref
}
