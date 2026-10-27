/**
 * 行動端輕量管線（Zero-Crash Mobile Pipeline）的開關。載入時決定一次、整個工作階段不再改變
 * （手機上動態切換 dpr / 後製 / 材質會重配 framebuffer 與重編 shader，iOS 會因此收回 WebGL context）。
 *
 * LEAN = 視窗寬 < 768 或主要指標是粗略觸控（手機、iPad）。桌面（M1 Pro Chrome 等）不受影響，畫質維持原樣。
 * 測試用覆寫：?lean=1 強制開、?lean=0 強制關；?dpr=2 改用 2x；?mediump=1 讓著色器用 mediump（見 Scene.tsx，需在實機比對畫面）。
 */
function detect() {
  if (typeof window === 'undefined') return false
  const q = /[?&]lean=([01])/.exec(location.search)
  if (q) return q[1] === '1'
  try {
    return window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches
  } catch {
    return window.innerWidth < 768
  }
}

export const LEAN = detect()
/** 固定 dpr（不在互動中改變）：裝置 dpr 與 1.5 取小。?dpr=2 可在實機上對照 2x 是否比 1.5x 清楚（載入時決定，不會動態切換） */
function pickDpr() {
  if (typeof window === 'undefined') return 1
  const q = /[?&]dpr=([0-9.]+)/.exec(location.search)
  const v = q ? Number(q[1]) : 1.5
  return Math.min(window.devicePixelRatio || 1, Math.min(3, Math.max(1, v)))
}
export const LEAN_DPR = pickDpr()
export const MEDIUMP = typeof window !== 'undefined' && /[?&]mediump=1/.test(location.search)
