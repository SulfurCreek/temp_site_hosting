import { Check, ChevronDown, ChevronUp, Copy, Frame, Image as ImageIcon, Layers, Lock, Move, RotateCcw, RotateCw, Sofa, Trash2, X } from 'lucide-react'
import { useRef } from 'react'
import { deleteSelected, duplicateSelected, rotateSelected, toggleMoving } from '../store/actions'
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
  { id: 'catalog', label: '家具', icon: <Sofa size={17} /> },
  { id: 'blueprint', label: '底圖', icon: <Frame size={17} /> },
  { id: 'reference', label: '參考', icon: <ImageIcon size={17} /> },
  { id: 'props', label: '屬性', icon: <Layers size={17} /> },
]

/**
 * 手機浮動「旋轉角度」列：選取家具時固定在抽屜上方（屬性頁的旋轉欄位在長捲動內、抽屜最高只有 32dvh，手機上幾乎碰不到）。
 * 拇指可及：±15° 微調 + 滑桿 + 數字，Slider 的連續拖動以 key 合併成同一筆復原紀錄。
 */
function RotationDock() {
  const sel = useUi((s) => s.selection)
  const f = useLayout((s) => (sel?.type === 'furniture' ? s.layout.furniture.find((x) => x.id === sel.id) : undefined))
  const update = useLayout((s) => s.updateFurniture)
  if (!f) return null
  const deg = Math.round((((f.rotationY % 360) + 540) % 360) - 180)
  const set = (v: number) => !f.locked && update(f.id, { rotationY: ((((v % 360) + 540) % 360) - 180) }, `${f.id}:rot`)
  const step = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 active:bg-white/20 disabled:opacity-40'
  return (
    <div className="glass pointer-events-auto mx-1 mb-1 flex h-11 items-center gap-1.5 rounded-xl px-2 text-slate-100 shadow-lg" role="group" aria-label="旋轉角度">
      <span className="shrink-0 text-[11px] font-semibold text-slate-300">{f.locked ? <Lock size={13} /> : '角度'}</span>
      <button aria-label="逆時針 15°" disabled={f.locked} className={step} onClick={() => rotateSelected(-15)}>
        <RotateCcw size={15} />
      </button>
      <input
        aria-label="旋轉角度"
        type="range"
        min={-180}
        max={180}
        step={1}
        value={deg}
        disabled={f.locked}
        onChange={(e) => set(Number(e.target.value))}
        className="h-8 min-w-0 flex-1 accent-sky-400"
      />
      <button aria-label="順時針 15°" disabled={f.locked} className={step} onClick={() => rotateSelected(15)}>
        <RotateCw size={15} />
      </button>
      <span className="w-11 shrink-0 text-right text-xs font-semibold tabular-nums">{deg}°</span>
    </div>
  )
}

const NAV_H = '44px'
// 三段：peek = 細橫桿（含標題與快速動作）、half = 18dvh、full = 整疊（含分頁列）不超過 32dvh
const SHEET_H: Record<SheetState, string> = {
  closed: '0px',
  peek: '44px',
  half: '18dvh',
  full: `calc(32dvh - ${NAV_H} - env(safe-area-inset-bottom))`,
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
  const moving = useUi((s) => s.moving)
  const hasFurniture = useLayout((s) => !!sel && sel.type === 'furniture' && s.layout.furniture.some((f) => f.id === sel.id))

  const shift = (dir: 1 | -1, from = sheet) => setSheet(ORDER[Math.min(ORDER.length - 1, Math.max(1, ORDER.indexOf(from) + dir))])
  const heading = tab === 'props' ? title : TABS.find((t) => t.id === tab)?.label

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col">
      <RotationDock />

      {/* 面板 */}
      <div
        className="glass sheet-compact pointer-events-auto mx-1 flex flex-col overflow-hidden rounded-t-2xl text-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.35)] transition-[height] duration-200"
        style={{ height: SHEET_H[sheet], visibility: sheet === 'closed' ? 'hidden' : 'visible' }}
      >
        <div
          className="flex shrink-0 touch-none flex-col items-center pt-1"
          onPointerDown={(e) => {
            if ((e.target as Element).closest('button')) return
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
          <span className="h-1 w-9 rounded-full bg-slate-500" />
          <div className="flex h-8 w-full items-center gap-1 px-2.5">
            <h2 className="min-w-0 flex-1 truncate text-xs font-semibold">{heading}</h2>
            {hasFurniture && (
              <>
                <button
                  onClick={() => toggleMoving()}
                  className={cx('flex h-7 items-center gap-1 rounded-lg px-2 text-[11px] font-semibold', moving ? 'bg-amber-400 text-slate-900' : 'bg-white/10 active:bg-white/20')}
                >
                  {moving ? <Check size={13} /> : <Move size={13} />}
                  {moving ? '完成' : '移動'}
                </button>
                <button aria-label="旋轉 90°" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 active:bg-white/20" onClick={() => rotateSelected(90)}>
                  <RotateCw size={14} />
                </button>
                <button aria-label="複製" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 active:bg-white/20" onClick={duplicateSelected}>
                  <Copy size={14} />
                </button>
                <button aria-label="刪除" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-red-300 active:bg-white/20" onClick={deleteSelected}>
                  <Trash2 size={14} />
                </button>
              </>
            )}
            {sheet === 'peek' ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </div>
        </div>
        {sheet !== 'peek' && (
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain pb-2">
            {tab === 'catalog' && <CatalogPanel />}
            {tab === 'blueprint' && <BlueprintPanel />}
            {tab === 'reference' && <ReferencePanel />}
            {tab === 'props' && <PropertiesPanel />}
          </div>
        )}
      </div>

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
              style={{ height: NAV_H }}
              className={cx('flex flex-1 flex-col items-center justify-center gap-px text-[10px] font-medium', active ? 'text-sky-300' : 'active:bg-white/10')}
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
