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
  /** 第一人稱前往指定立足點（nonce 讓同一點可重複觸發；yaw 為弧度，null = 保持目前朝向） */
  fpGoto: { x: number; z: number; yaw: number | null; nonce: number }
  goVantage: (x: number, z: number, yaw?: number | null, eye?: EyeMode) => void
  eye: EyeMode
  standCm: number
  fov: number
  /** 攝影師退後距離（cm，0 = 關閉） */
  backoffCm: number
  setEye: (e: EyeMode) => void
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

  /** 當前拖拉中（用來暫停破牆閃爍等） */
  dragging: boolean
  setDragging: (v: boolean) => void
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useUi = create<UiState>()((set) => ({
  selection: null,
  // 換選取對象時自動離開移動模式
  // 第一人稱 / 放置立足點時不開啟選取（點地板是移動，不是選地板）
  select: (selection) =>
    set((st) => (selection && st.viewMode === 'firstPerson' ? {} : { selection, moving: false })),

  viewMode: 'isometric',
  setViewMode: (viewMode) => set(viewMode === 'firstPerson' ? { viewMode, selection: null, moving: false } : { viewMode }),
  fpGoto: { x: 0, z: 0, yaw: null, nonce: 0 },
  goVantage: (x, z, yaw = null, eye) =>
    set((st) => ({
      viewMode: 'firstPerson',
      selection: null,
      moving: false,
      eye: eye ?? st.eye,
      fpGoto: { x, z, yaw, nonce: st.fpGoto.nonce + 1 },
    })),
  eye: 'stand',
  standCm: 168,
  fov: 75,
  backoffCm: 50,
  setEye: (eye) => set({ eye }),
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
