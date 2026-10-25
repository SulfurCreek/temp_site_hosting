import { useThree } from '@react-three/fiber'
import { useMemo } from 'react'
import { useUi } from '../store/uiStore'

const D = Math.PI / 180

/** 直拿手機時要維持的最小水平視角（等效全片幅約 16–18 mm 超廣角） */
export const MIN_HFOV = 82
/** 垂直視角上限，避免極窄螢幕邊緣過度拉伸 */
export const MAX_VFOV = 125

/**
 * Three.js 的 `fov` 是垂直視角。橫向（aspect ≥ 1）直接用 baseV；
 * 直向（aspect < 1）水平視角 = 2·atan(aspect·tan(vfov/2)) 會被裁窄，
 * 所以反推「達到 MIN_HFOV 所需的垂直視角」：vfov = 2·atan(tan(MIN_HFOV/2) / aspect)。
 */
export function responsiveVFov(aspect: number, baseV: number) {
  if (!(aspect > 0) || aspect >= 1) return baseV
  const need = 2 * Math.atan(Math.tan((MIN_HFOV * D) / 2) / aspect) / D
  return Math.min(MAX_VFOV, Math.max(baseV, need))
}

export const hFovOf = (vfov: number, aspect: number) => (2 * Math.atan(Math.tan((vfov * D) / 2) * aspect)) / D

/** 依畫布長寬比回傳第一人稱相機應使用的垂直 fov（度） */
export function useResponsiveFOV() {
  const w = useThree((s) => s.size.width)
  const h = useThree((s) => s.size.height)
  const base = useUi((s) => s.fov)
  return useMemo(() => responsiveVFov(w / Math.max(h, 1), base), [w, h, base])
}
