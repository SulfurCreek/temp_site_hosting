import { Check, ChevronDown, ChevronUp, Copy, Frame, Image as ImageIcon, Layers, Lock, Move, RotateCcw, RotateCw, Sofa, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
const PEEK_PX = 44
// 面板固定為「全展開」高度，靠 transform: translateY 露出多少；高度從不變動（不觸發 layout），手指拖曳時由 JS 直接改 transform，與手指 1:1 跟手。
// 三段：peek = 細橫桿（含標題與快速動作）、half = 18dvh、full = 整疊（含分頁列）不超過 32dvh
const FULL_H = `calc(32dvh - ${NAV_H} - env(safe-area-inset-bottom))`
const ORDER: SheetState[] = ['closed', 'peek', 'half', 'full']
const EASE = 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)'

export function BottomSheet() {
  const tab = useUi((s) => s.mobileTab)
  const sheet = useUi((s) => s.sheet)
  const sel = useUi((s) => s.selection)
  const openSheet = useUi((s) => s.openSheet)
  const setSheet = useUi((s) => s.setSheet)
  const title = useSelectionTitle()
  const moving = useUi((s) => s.moving)
  const hasFurniture = useLayout((s) => !!sel && sel.type === 'furniture' && s.layout.furniture.some((f) => f.id === sel.id))
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; y0: number; off0: number; t0: number; pts: { y: number; t: number }[]; moved: boolean; start: SheetState } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [, bump] = useState(0)

  const heading = tab === 'props' ? title : TABS.find((t) => t.id === tab)?.label

  /** 各段露出的像素高度（面板全高 = 全展開） */
  const snaps = useCallback((): Record<SheetState, number> => {
    const full = panel.current?.offsetHeight ?? 0
    const half = Math.min(full, Math.round(window.innerHeight * 0.18))
    return { closed: 0, peek: PEEK_PX, half, full }
  }, [])
  const offsetFor = (st: SheetState) => {
    const full = panel.current?.offsetHeight ?? 0
    return full - snaps()[st] // translateY 量：0 = 全展開
  }

  const place = useCallback((off: number, animate: boolean) => {
    const el = panel.current
    if (!el) return
    el.style.transition = animate ? EASE : 'none'
    el.style.transform = `translate3d(0, ${off}px, 0)`
  }, [])

  // 狀態變化 / 視窗尺寸改變 → 動畫到對應的段
  useLayoutEffect(() => {
    place(offsetFor(sheet), !drag.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, place, bump])
  useEffect(() => {
    const on = () => bump((n) => n + 1)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  const settle = (target: SheetState) => {
    if (target === sheet) place(offsetFor(target), true)
    else setSheet(target)
  }

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest('button')) return
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    const cur = new DOMMatrixReadOnly(getComputedStyle(panel.current!).transform).m42 // 動畫途中接手也不跳
    drag.current = { id: e.pointerId, y0: e.clientY, off0: cur, t0: e.timeStamp, pts: [{ y: e.clientY, t: e.timeStamp }], moved: false, start: sheet }
    place(cur, false)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dy = e.clientY - d.y0
    if (!d.moved && Math.abs(dy) < 4) return
    if (!d.moved) {
      d.moved = true
      setDragging(true) // peek 時內容尚未掛載，拖曳開始才掛載
    }
    d.pts.push({ y: e.clientY, t: e.timeStamp })
    if (d.pts.length > 6) d.pts.shift()
    const full = panel.current!.offsetHeight
    let off = d.off0 + dy
    const minOff = 0
    const maxOff = full - snaps().peek
    if (off < minOff) off = minOff + (off - minOff) * 0.25 // 越界阻尼
    else if (off > maxOff) off = maxOff + (off - maxOff) * 0.25
    place(off, false)
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    setDragging(false)
    if (!d.moved) {
      // 點一下：循環展開 / 收合
      const n = Math.min(ORDER.length - 1, Math.max(1, ORDER.indexOf(d.start) + (d.start === 'full' ? -1 : 1)))
      settle(ORDER[n])
      return
    }
    const cur = new DOMMatrixReadOnly(getComputedStyle(panel.current!).transform).m42
    const first = d.pts[0]
    const last = d.pts[d.pts.length - 1]
    const v = last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0 // px/ms，向下為正
    // 依「投影落點」(位置 + 速度 × 120ms) 吸附到最近的一段，快速甩動可跳段
    const proj = cur + v * 120
    const sn = snaps()
    const full = panel.current!.offsetHeight
    let best: SheetState = 'peek'
    let bd = Infinity
    for (const st of ['peek', 'half', 'full'] as const) {
      const dist = Math.abs(proj - (full - sn[st]))
      if (dist < bd) {
        bd = dist
        best = st
      }
    }
    settle(best)
  }
  const onCancel = () => {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
    place(offsetFor(sheet), true)
  }

  const showBody = sheet !== 'peek' || dragging
  const reveal = panel.current ? snaps()[sheet] : 0
  const hidden = panel.current ? panel.current.offsetHeight - reveal : 0

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col">
      {/* 面板（高度固定為全展開；外層裁切，讓下滑時被分頁列遮住而不是疊在它上面） */}
      <div className="pointer-events-none relative mx-1 shrink-0" style={{ height: FULL_H, visibility: sheet === 'closed' ? 'hidden' : 'visible', clipPath: 'inset(-90px 0 0 0)' }}>
        <div
          ref={panel}
          className="glass sheet-compact pointer-events-auto absolute inset-x-0 bottom-0 flex h-full flex-col rounded-t-2xl text-slate-100 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
          style={{ willChange: 'transform' }}
        >
          {/* 旋轉角度列：固定在抽屜頂緣上方，隨抽屜一起移動 */}
          <div className="absolute inset-x-0 bottom-full">
            <RotationDock />
          </div>
          <div
            className="flex shrink-0 touch-none flex-col items-center pt-1"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onCancel}
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
          {showBody && (
            // 底部補上「被推到畫面外的高度」，捲到底時最後一項不會被裁掉
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain" style={{ paddingBottom: hidden + 8 }}>
              {tab === 'catalog' && <CatalogPanel />}
              {tab === 'blueprint' && <BlueprintPanel />}
              {tab === 'reference' && <ReferencePanel />}
              {tab === 'props' && <PropertiesPanel />}
            </div>
          )}
        </div>
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
