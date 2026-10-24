import { ChevronDown, ChevronUp, Copy, Frame, Image as ImageIcon, Layers, RotateCw, Sofa, Trash2, X } from 'lucide-react'
import { useRef } from 'react'
import { deleteSelected, duplicateSelected, rotateSelected } from '../store/actions'
import { useLayout } from '../store/layoutStore'
import { useUi, type MobileTab, type SheetState } from '../store/uiStore'
import { cx, IconBtn, Section } from './controls'
import { BlueprintPanel, CatalogPanel, ReferencePanel } from './LeftPanels'
import { PropertiesPanel, useSelectionTitle } from './PropertiesPanel'

/* ------------------------------ 桌面：左側可收合抽屜 ------------------------------ */

export function LeftDrawer() {
  const open = useUi((s) => s.leftOpen)
  return (
    <aside
      className={cx(
        'glass scroll-thin absolute bottom-3 left-3 top-3 z-20 w-[320px] overflow-y-auto rounded-2xl text-slate-100 shadow-2xl transition-transform duration-300',
        open ? 'translate-x-0' : '-translate-x-[340px]',
      )}
      aria-hidden={!open}
    >
      <Section title="家具目錄" icon={<Sofa size={16} className="text-sky-300" />}>
        <div className="-mx-4 -mb-4">
          <CatalogPanel />
        </div>
      </Section>
      <Section title="施工圖底圖" icon={<Frame size={16} className="text-sky-300" />} defaultOpen={false}>
        <div className="-mx-4 -mb-4">
          <BlueprintPanel />
        </div>
      </Section>
      <Section title="實景 / 靈感參考圖庫" icon={<ImageIcon size={16} className="text-sky-300" />} defaultOpen={false}>
        <div className="-mx-4 -mb-4">
          <ReferencePanel />
        </div>
      </Section>
    </aside>
  )
}

/* ------------------------------ 桌面：右側屬性面板（點選後滑出） ------------------------------ */

export function RightPanel() {
  const sel = useUi((s) => s.selection)
  const select = useUi((s) => s.select)
  const title = useSelectionTitle()
  return (
    <aside
      className={cx(
        'glass scroll-thin absolute bottom-3 right-3 top-3 z-20 flex w-[330px] flex-col overflow-hidden rounded-2xl text-slate-100 shadow-2xl transition-transform duration-300',
        sel ? 'translate-x-0' : 'translate-x-[360px]',
      )}
      aria-hidden={!sel}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <Layers size={16} className="text-sky-300" />
        <h2 className="flex-1 truncate text-sm font-semibold">{title}</h2>
        <IconBtn title="取消選取 (Esc)" onClick={() => select(null)} className="h-7 w-7">
          <X size={16} />
        </IconBtn>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">{sel && <PropertiesPanel />}</div>
    </aside>
  )
}

/* ------------------------------ 手機 / 平板：底部抽屜 ------------------------------ */

const TABS: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
  { id: 'catalog', label: '家具', icon: <Sofa size={19} /> },
  { id: 'blueprint', label: '底圖', icon: <Frame size={19} /> },
  { id: 'reference', label: '參考', icon: <ImageIcon size={19} /> },
  { id: 'props', label: '屬性', icon: <Layers size={19} /> },
]

const SHEET_H: Record<SheetState, string> = {
  closed: '0px',
  peek: '56px',
  half: '46dvh',
  full: '88dvh',
}
const ORDER: SheetState[] = ['closed', 'peek', 'half', 'full']

export function BottomSheet() {
  const tab = useUi((s) => s.mobileTab)
  const sheet = useUi((s) => s.sheet)
  const sel = useUi((s) => s.selection)
  const openSheet = useUi((s) => s.openSheet)
  const setSheet = useUi((s) => s.setSheet)
  const title = useSelectionTitle()
  const drag = useRef<{ y: number; start: SheetState } | null>(null)
  const hasFurniture = useLayout((s) => !!sel && sel.type === 'furniture' && s.layout.furniture.some((f) => f.id === sel.id))

  const shift = (dir: 1 | -1, from = sheet) => setSheet(ORDER[Math.min(ORDER.length - 1, Math.max(1, ORDER.indexOf(from) + dir))])

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col">
      {/* 面板 */}
      <div
        className="glass pointer-events-auto mx-1 flex flex-col overflow-hidden rounded-t-2xl text-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.35)] transition-[height] duration-200"
        style={{ height: SHEET_H[sheet], visibility: sheet === 'closed' ? 'hidden' : 'visible' }}
      >
        <div
          className="flex shrink-0 touch-none flex-col items-center pt-1.5"
          onPointerDown={(e) => {
            ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
            drag.current = { y: e.clientY, start: sheet }
          }}
          onPointerUp={(e) => {
            const d = drag.current
            drag.current = null
            if (!d) return
            const dy = e.clientY - d.y
            if (Math.abs(dy) < 8) shift(d.start === 'full' ? -1 : 1, d.start)
            else shift(dy < 0 ? 1 : -1, d.start)
          }}
        >
          <span className="h-1 w-10 rounded-full bg-slate-500" />
          <div className="flex w-full items-center gap-2 px-4 py-2">
            <h2 className="flex-1 truncate text-sm font-semibold">{tab === 'props' ? title : TABS.find((t) => t.id === tab)?.label}</h2>
            {sheet === 'peek' ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </div>
        </div>
        {sheet !== 'peek' && (
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
            {tab === 'catalog' && <CatalogPanel />}
            {tab === 'blueprint' && <BlueprintPanel />}
            {tab === 'reference' && <ReferencePanel />}
            {tab === 'props' && <PropertiesPanel />}
          </div>
        )}
      </div>

      {/* 快速動作列：選取家具時顯示 */}
      {hasFurniture && sheet !== 'full' && (
        <div className="pointer-events-auto glass mx-1 flex items-center justify-around border-t border-white/10 py-1 text-slate-100">
          <IconBtn title="旋轉 90°" onClick={() => rotateSelected(90)}>
            <RotateCw size={18} />
          </IconBtn>
          <button className="rounded-lg px-3 py-2 text-xs font-medium active:bg-white/10" onClick={() => rotateSelected(45)}>
            45°
          </button>
          <IconBtn title="複製" onClick={duplicateSelected}>
            <Copy size={18} />
          </IconBtn>
          <IconBtn title="刪除" onClick={deleteSelected} className="text-red-300">
            <Trash2 size={18} />
          </IconBtn>
        </div>
      )}

      {/* 分頁列 */}
      <nav className="glass safe-bottom pointer-events-auto flex border-x-0 border-b-0 text-slate-300">
        {TABS.map((t) => {
          const active = sheet !== 'closed' && tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => {
                if (active) setSheet(sheet === 'peek' ? 'half' : 'closed')
                else openSheet(t.id, sheet === 'closed' || sheet === 'peek' ? 'half' : sheet)
              }}
              className={cx('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', active ? 'text-sky-300' : 'active:bg-white/10')}
            >
              {t.icon}
              {t.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
