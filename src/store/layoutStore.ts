import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { BASE_CATALOG, DEFAULT_LAYOUT } from '../data'
import { uid } from '../lib/ids'
import { safeStorage } from '../lib/storage'
import type {
  Blueprint,
  CatalogItem,
  Floor,
  FloorZone,
  FurnitureInstance,
  Layout,
  ReferenceImage,
  Settings,
  Vec3,
  Wall,
} from '../types'

export const DEFAULT_SETTINGS: Settings = {
  projection: 'ortho',
  cutaway: 'lower',
  kelvin: 4000,
  snap: 0.05,
  tool: 'drag',
  showGrid: true,
  showHud: true,
  showMep: false,
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

/** 驗證/補齊匯入的 layout.json；格式不對會丟出 Error */
export function normalizeLayout(raw: unknown): Layout {
  const l = raw as Partial<Layout> | null
  if (!l || typeof l !== 'object' || !l.floor || !Array.isArray(l.walls) || !Array.isArray(l.furniture))
    throw new Error('格式不正確：需要 floor / walls / furniture')
  return {
    version: 1,
    rev: l.rev,
    name: l.name ?? '未命名格局',
    floor: l.floor,
    floorZones: l.floorZones ?? [],
    walls: l.walls.map((w) => ({ ...w, openings: w.openings ?? [] })),
    furniture: l.furniture,
    blueprint: l.blueprint ?? null,
    references: l.references ?? [],
    customCatalog: l.customCatalog ?? [],
  }
}

export function findCatalogItem(id: string, custom: CatalogItem[]): CatalogItem | undefined {
  return custom.find((c) => c.id === id) ?? BASE_CATALOG.find((c) => c.id === id)
}

interface LayoutState {
  layout: Layout
  settings: Settings
  past: Layout[]
  future: Layout[]

  setSettings: (p: Partial<Settings>) => void
  loadLayout: (raw: unknown) => void
  resetLayout: () => void
  setName: (name: string) => void

  updateFloor: (p: Partial<Floor>, key?: string) => void
  updateZone: (id: string, p: Partial<FloorZone>, key?: string) => void
  updateWall: (id: string, p: Partial<Wall>, key?: string) => void
  fitFloorToWalls: () => void

  addFurniture: (item: CatalogItem, at?: Vec3) => string
  updateFurniture: (id: string, p: Partial<FurnitureInstance>, key?: string) => void
  removeFurniture: (id: string) => void
  duplicateFurniture: (id: string) => string | null
  rotateFurniture: (id: string, deg: number) => void

  setBlueprint: (p: Partial<Blueprint> | null, key?: string) => void
  addReference: (r: Omit<ReferenceImage, 'id'>) => string
  removeReference: (id: string) => void
  addCustomCatalog: (item: CatalogItem) => void

  undo: () => void
  redo: () => void
}

let lastKey = ''
let lastAt = 0

export const useLayout = create<LayoutState>()(
  persist(
    (set, get) => {
      /** 套用一次「可撤銷」的變更；相同 key 在 900ms 內連續變更（滑桿）合併為一筆歷史 */
      const mutate = (fn: (l: Layout) => Layout, key?: string) => {
        const cur = get().layout
        const next = fn(cur)
        if (next === cur) return
        const now = Date.now()
        const merge = !!key && key === lastKey && now - lastAt < 900
        lastKey = key ?? ''
        lastAt = now
        set((s) => ({ layout: next, past: merge ? s.past : [...s.past.slice(-59), cur], future: [] }))
      }

      return {
        layout: clone(DEFAULT_LAYOUT),
        settings: DEFAULT_SETTINGS,
        past: [],
        future: [],

        setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
        // 匯入的格局視為「使用者資料」，套用目前預設 rev，重新整理後不會被新版預設取代
        loadLayout: (raw) => mutate(() => ({ ...normalizeLayout(raw), rev: DEFAULT_LAYOUT.rev })),
        resetLayout: () => mutate(() => clone(DEFAULT_LAYOUT)),
        setName: (name) => mutate((l) => ({ ...l, name }), 'name'),

        updateFloor: (p, key) => mutate((l) => ({ ...l, floor: { ...l.floor, ...p } }), key),
        updateZone: (id, p, key) =>
          mutate((l) => ({ ...l, floorZones: (l.floorZones ?? []).map((z) => (z.id === id ? { ...z, ...p } : z)) }), key),
        updateWall: (id, p, key) =>
          mutate((l) => ({ ...l, walls: l.walls.map((w) => (w.id === id ? { ...w, ...p } : w)) }), key),
        fitFloorToWalls: () =>
          mutate((l) => {
            const xs = l.walls.flatMap((w) => [w.start[0], w.end[0]])
            const zs = l.walls.flatMap((w) => [w.start[1], w.end[1]])
            if (!xs.length) return l
            const t = Math.max(...l.walls.map((w) => w.thickness)) / 2
            const x0 = Math.min(...xs) + t
            const x1 = Math.max(...xs) - t
            const z0 = Math.min(...zs) + t
            const z1 = Math.max(...zs) - t
            const r = (v: number) => Math.round(v * 1000) / 1000
            return {
              ...l,
              floor: { ...l.floor, center: [r((x0 + x1) / 2), r((z0 + z1) / 2)], size: [r(x1 - x0), r(z1 - z0)] },
            }
          }),

        addFurniture: (item, at) => {
          const id = uid('f')
          mutate((l) => {
            let [x, z] = [l.floor.center[0], l.floor.center[1]]
            if (at) [x, , z] = at
            else
              while (l.furniture.some((f) => Math.abs(f.position[0] - x) < 0.05 && Math.abs(f.position[2] - z) < 0.05)) {
                x += 0.3
                z += 0.3
              }
            const inst: FurnitureInstance = {
              id,
              catalogId: item.id,
              name: item.name,
              position: [x, at?.[1] ?? 0, z],
              rotationY: 0,
              size: [...item.size],
              ...(item.parametric?.decals ? { decals: clone(item.parametric.decals) } : {}),
            }
            return { ...l, furniture: [...l.furniture, inst] }
          })
          return id
        },
        updateFurniture: (id, p, key) =>
          mutate(
            (l) => ({ ...l, furniture: l.furniture.map((f) => (f.id === id ? { ...f, ...p } : f)) }),
            key,
          ),
        removeFurniture: (id) => mutate((l) => ({ ...l, furniture: l.furniture.filter((f) => f.id !== id) })),
        duplicateFurniture: (id) => {
          const src = get().layout.furniture.find((f) => f.id === id)
          if (!src) return null
          const nid = uid('f')
          mutate((l) => ({
            ...l,
            furniture: [
              ...l.furniture,
              { ...clone(src), id: nid, position: [src.position[0] + 0.3, src.position[1], src.position[2] + 0.3] },
            ],
          }))
          return nid
        },
        rotateFurniture: (id, deg) =>
          mutate((l) => ({
            ...l,
            furniture: l.furniture.map((f) =>
              f.id === id ? { ...f, rotationY: ((((f.rotationY + deg) % 360) + 540) % 360) - 180 } : f,
            ),
          })),

        setBlueprint: (p, key) =>
          mutate((l) => {
            if (p === null) return { ...l, blueprint: null }
            const base: Blueprint = l.blueprint ?? {
              url: '',
              widthMeters: 6,
              opacity: 0.6,
              offset: [0, 0],
              rotation: 0,
              visible: true,
              placement: 'under',
            }
            return { ...l, blueprint: { ...base, ...p } }
          }, key),
        addReference: (r) => {
          const id = uid('ref')
          mutate((l) => ({ ...l, references: [...l.references, { ...r, id }] }))
          return id
        },
        removeReference: (id) => mutate((l) => ({ ...l, references: l.references.filter((r) => r.id !== id) })),
        addCustomCatalog: (item) => mutate((l) => ({ ...l, customCatalog: [...l.customCatalog, item] })),

        undo: () =>
          set((s) => {
            const prev = s.past[s.past.length - 1]
            if (!prev) return s
            lastKey = ''
            return { layout: prev, past: s.past.slice(0, -1), future: [s.layout, ...s.future].slice(0, 60) }
          }),
        redo: () =>
          set((s) => {
            const next = s.future[0]
            if (!next) return s
            lastKey = ''
            return { layout: next, past: [...s.past, s.layout], future: s.future.slice(1) }
          }),
      }
    },
    {
      name: 'interior-planner:v1',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ layout: s.layout, settings: s.settings }),
      merge: (persisted, current) => {
        const p = persisted as Partial<Pick<LayoutState, 'layout' | 'settings'>> | undefined
        if (!p) return current
        let layout = current.layout
        let past: Layout[] = []
        try {
          if (p.layout) {
            const saved = normalizeLayout(p.layout)
            if ((saved.rev ?? 0) < (DEFAULT_LAYOUT.rev ?? 0)) {
              // defaultLayout.json 有新版：改用新版預設，舊版放進復原堆疊（Ctrl+Z 可找回）
              past = [saved]
              queueMicrotask(() => window.dispatchEvent(new CustomEvent('app:toast', { detail: '已套用新版預設格局（Ctrl+Z 可還原你先前的版本）' })))
            } else layout = saved
          }
        } catch {
          /* 損毀的存檔 → 使用預設格局 */
        }
        return { ...current, layout, past, settings: { ...DEFAULT_SETTINGS, ...p.settings } }
      },
    },
  ),
)

export function useCatalog() {
  const custom = useLayout((s) => s.layout.customCatalog)
  return [...BASE_CATALOG, ...custom]
}
