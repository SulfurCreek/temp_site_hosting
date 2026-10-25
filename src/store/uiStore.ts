import { create } from 'zustand'
import type { EyeMode, Selection, Vec2, ViewMode, ViewPreset } from '../types'

export type MobileTab = 'catalog' | 'blueprint' | 'reference' | 'props'
export type SheetState = 'closed' | 'peek' | 'half' | 'full'
export type PipMode = 'pip' | 'onion' | 'split'

interface UiState {
  selection: Selection
  select: (s: Selection) => void

  /** 世紀帝國俯視 / 第一人稱立足點 */
  viewMode: ViewMode
  setViewMode: (m: ViewMode) => void
  /** 俯視角「📍 放置立足點」模式 */
  placing: boolean
  setPlacing: (v: boolean) => void
  /** 第一人稱前往指定立足點（nonce 讓同一點可重複觸發；yaw 為弧度，null = 保持目前朝向） */
  fpGoto: { x: number; z: number; yaw: number | null; nonce: number }
  goVantage: (x: number, z: number, yaw?: number | null, eye?: EyeMode) => void
  eye: EyeMode
  standCm: number
  fov: number
  /** 攝影師退後距離（cm，0 = 關閉） */
  backoffCm: number
  /** 第一人稱景深（DepthOfField）開關 */
  dof: boolean
  setDof: (v: boolean) => void
  setBackoffCm: (cm: number) => void
  setEye: (e: EyeMode) => void
  setStandCm: (cm: number) => void
  setFov: (deg: number) => void
  /** 移動模式：選取後需明確進入才會拖拉/顯示位移軸 */
  moving: boolean
  setMoving: (v: boolean) => void

  /** 目前點選的水電/燈具標記 id */
  mepId: string | null
  selectMep: (id: string | null) => void

  leftOpen: boolean
  setLeftOpen: (v: boolean) => void

  mobileTab: MobileTab
  sheet: SheetState
  openSheet: (tab: MobileTab, sheet?: SheetState) => void
  setSheet: (s: SheetState) => void

  /** 工具列請求切換視角（nonce 讓同一個預設可重複觸發） */
  viewRequest: { preset: ViewPreset; nonce: number }
  requestView: (p: ViewPreset) => void
  currentView: ViewPreset | null
  setCurrentView: (p: ViewPreset | null) => void

  /** 兩點比例尺校準 */
  calib: { active: boolean; points: Vec2[] }
  startCalib: () => void
  addCalibPoint: (p: Vec2) => void
  endCalib: () => void

  /** 實景與靈感對照 */
  pip: { open: boolean; refId: string | null; mode: PipMode; opacity: number; split: number; eyedropper: boolean }
  setPip: (p: Partial<UiState['pip']>) => void
  pickedColor: string | null
  setPickedColor: (c: string | null) => void

  toast: string | null
  showToast: (m: string) => void

  /** 相片級算圖模式（靜態高畫質：dpr 2、MSAA、2048 陰影、柔陰影、可匯出 4K） */
  studio: boolean
  setStudio: (v: boolean) => void
  /** 匯出 4K PNG 請求計數 */
  exportNonce: number
  requestExport: () => void
  exporting: boolean
  setExporting: (v: boolean) => void

  /** 高品質渲染（路徑追蹤，進階） */
  pt: PtState
  setPt: (p: Partial<PtState>) => void

  /** 當前拖拉中（用來暫停破牆閃爍等） */
  dragging: boolean
  setDragging: (v: boolean) => void
}

export interface PtState {
  active: boolean
  samples: number
  target: number
  /** 1 = 全解析度；0.5 = 半解析度（較快） */
  scale: number
  status: 'idle' | 'building' | 'rendering' | 'done' | 'error'
  /** 下載 PNG 的請求計數（Scene 內的渲染器收到後輸出） */
  saveNonce: number
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useUi = create<UiState>()((set) => ({
  selection: null,
  // 換選取對象時自動離開移動模式
  // 第一人稱 / 放置立足點時不開啟選取（點地板是移動，不是選地板）
  select: (selection) =>
    set((st) => (selection && (st.viewMode === 'firstPerson' || st.placing) ? {} : { selection, moving: false })),

  viewMode: 'isometric',
  setViewMode: (viewMode) => set(viewMode === 'firstPerson' ? { viewMode, placing: false, selection: null, moving: false } : { viewMode, placing: false }),
  placing: false,
  setPlacing: (placing) => set(placing ? { placing, viewMode: 'isometric', selection: null, moving: false } : { placing }),
  fpGoto: { x: 0, z: 0, yaw: null, nonce: 0 },
  goVantage: (x, z, yaw = null, eye) =>
    set((st) => ({
      viewMode: 'firstPerson',
      placing: false,
      selection: null,
      moving: false,
      eye: eye ?? st.eye,
      fpGoto: { x, z, yaw, nonce: st.fpGoto.nonce + 1 },
    })),
  eye: 'stand',
  standCm: 165,
  fov: 75,
  backoffCm: 50,
  dof: true,
  setDof: (dof) => set({ dof }),
  setBackoffCm: (cm) => set({ backoffCm: Math.min(60, Math.max(0, Math.round(cm))) }),
  setEye: (eye) => set({ eye }),
  setStandCm: (standCm) => set({ standCm: Math.min(185, Math.max(150, Math.round(standCm))) }),
  setFov: (fov) => set({ fov: Math.min(90, Math.max(50, Math.round(fov))) }),
  moving: false,
  setMoving: (moving) => set({ moving }),

  mepId: null,
  selectMep: (mepId) => set({ mepId }),

  leftOpen: true,
  setLeftOpen: (leftOpen) => set({ leftOpen }),

  mobileTab: 'catalog',
  sheet: 'closed',
  openSheet: (mobileTab, sheet = 'half') => set({ mobileTab, sheet }),
  setSheet: (sheet) => set({ sheet }),

  viewRequest: { preset: 'SE', nonce: 0 },
  requestView: (preset) => set((s) => ({ viewRequest: { preset, nonce: s.viewRequest.nonce + 1 } })),
  currentView: 'SE',
  setCurrentView: (currentView) => set({ currentView }),

  calib: { active: false, points: [] },
  startCalib: () => set({ calib: { active: true, points: [] } }),
  addCalibPoint: (p) =>
    set((s) => (s.calib.points.length >= 2 ? s : { calib: { ...s.calib, points: [...s.calib.points, p] } })),
  endCalib: () => set({ calib: { active: false, points: [] } }),

  pip: { open: false, refId: null, mode: 'pip', opacity: 0.5, split: 0.5, eyedropper: false },
  setPip: (p) => set((s) => ({ pip: { ...s.pip, ...p } })),
  pickedColor: null,
  setPickedColor: (pickedColor) => set({ pickedColor }),

  studio: false,
  setStudio: (studio) => set({ studio }),
  exportNonce: 0,
  requestExport: () => set((s) => ({ exportNonce: s.exportNonce + 1 })),
  exporting: false,
  setExporting: (exporting) => set({ exporting }),
  pt: { active: false, samples: 0, target: 256, scale: 1, status: 'idle', saveNonce: 0 },
  setPt: (p) => set((s) => ({ pt: { ...s.pt, ...p } })),

  toast: null,
  showToast: (toast) => {
    set({ toast })
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => set({ toast: null }), 3200)
  },

  dragging: false,
  setDragging: (dragging) => set({ dragging }),
}))

if (typeof window !== 'undefined')
  window.addEventListener('app:toast', (e) => useUi.getState().showToast((e as CustomEvent<string>).detail))
