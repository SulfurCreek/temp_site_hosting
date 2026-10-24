import { create } from 'zustand'
import type { Selection, Vec2, ViewPreset } from '../types'

export type MobileTab = 'catalog' | 'blueprint' | 'reference' | 'props'
export type SheetState = 'closed' | 'peek' | 'half' | 'full'
export type PipMode = 'pip' | 'onion' | 'split'

interface UiState {
  selection: Selection
  select: (s: Selection) => void

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
  select: (selection) => set({ selection }),

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
