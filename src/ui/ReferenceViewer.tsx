import { Columns2, Copy, GripHorizontal, Layers, PictureInPicture2, Pipette, Wand2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { applyColorToSelection } from '../store/actions'
import { useLayout } from '../store/layoutStore'
import { useUi, type PipMode } from '../store/uiStore'
import { IconBtn, Slider, cx } from './controls'
import { useIsMobile } from './hooks'

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** 在 <img>（object-contain）上點擊位置取 5×5 平均色 */
function sampleColor(e: React.MouseEvent<HTMLImageElement>): string | null {
  const img = e.currentTarget
  const r = img.getBoundingClientRect()
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  if (!nw || !nh) return null
  const k = Math.min(r.width / nw, r.height / nh)
  const ox = (r.width - nw * k) / 2
  const oy = (r.height - nh * k) / 2
  const x = (e.clientX - r.left - ox) / k
  const y = (e.clientY - r.top - oy) / k
  if (x < 0 || y < 0 || x >= nw || y >= nh) return null
  const cv = document.createElement('canvas')
  cv.width = cv.height = 1
  const g = cv.getContext('2d', { willReadFrequently: true })!
  try {
    g.drawImage(img, Math.max(0, x - 2), Math.max(0, y - 2), 5, 5, 0, 0, 1, 1)
    const d = g.getImageData(0, 0, 1, 1).data
    return toHex(d[0], d[1], d[2])
  } catch {
    useUi.getState().showToast('此圖片無法取色（跨網域限制）')
    return null
  }
}

const MODES: { id: PipMode; label: string; icon: React.ReactNode }[] = [
  { id: 'pip', label: '懸浮視窗', icon: <PictureInPicture2 size={16} /> },
  { id: 'onion', label: '半透明疊加 (Onion Skin)', icon: <Layers size={16} /> },
  { id: 'split', label: '左右分割', icon: <Columns2 size={16} /> },
]

/**
 * 實景與靈感對照懸浮窗。
 * - pip：可拖曳的小視窗
 * - onion：參考圖以可調透明度疊在整個 3D 畫面上
 * - split：左半邊是參考圖、右半邊是 3D，中線可拖曳
 */
export function ReferenceViewer() {
  const pip = useUi((s) => s.pip)
  const setPip = useUi((s) => s.setPip)
  const picked = useUi((s) => s.pickedColor)
  const refs = useLayout((s) => s.layout.references)
  const ref = refs.find((r) => r.id === pip.refId)
  const mobile = useIsMobile()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const winRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLDivElement>(null)

  if (!pip.open || !ref) return null

  const startDrag = (e: React.PointerEvent) => {
    const win = winRef.current
    const area = win?.offsetParent as HTMLElement | null
    if (!win || !area) return
    const a = area.getBoundingClientRect()
    const w = win.getBoundingClientRect()
    const dx = e.clientX - w.left
    const dy = e.clientY - w.top
    const move = (ev: PointerEvent) =>
      setPos({
        x: Math.min(a.width - 60, Math.max(-w.width + 60, ev.clientX - a.left - dx)),
        y: Math.min(a.height - 40, Math.max(0, ev.clientY - a.top - dy)),
      })
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const startSplit = (e: React.PointerEvent) => {
    const area = areaRef.current?.getBoundingClientRect()
    if (!area) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => setPip({ split: Math.min(0.95, Math.max(0.05, (ev.clientX - area.left) / area.width)) })
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <>
      {/* 全畫面疊加層 */}
      <div ref={areaRef} className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {pip.mode === 'onion' && (
          <img src={ref.url} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: pip.opacity }} draggable={false} />
        )}
        {pip.mode === 'split' && (
          <>
            <img
              src={ref.url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ clipPath: `inset(0 ${(1 - pip.split) * 100}% 0 0)` }}
              draggable={false}
            />
            <div className="pointer-events-auto absolute inset-y-0 z-10 w-6 -translate-x-1/2 cursor-col-resize touch-none" style={{ left: `${pip.split * 100}%` }} onPointerDown={startSplit}>
              <div className="mx-auto h-full w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" />
              <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-700 shadow-lg">
                <Columns2 size={16} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 控制 / 懸浮視窗 */}
      <div
        ref={winRef}
        className={cx(
          'glass absolute z-30 flex flex-col overflow-hidden rounded-xl text-slate-100 shadow-2xl',
          mobile ? 'w-[min(72vw,320px)]' : 'w-[340px]',
        )}
        style={pos ? { left: pos.x, top: pos.y } : mobile ? { right: 8, top: 60 } : { right: 16, bottom: 16 }}
      >
        <div className="flex cursor-grab touch-none items-center gap-1 border-b border-white/10 px-2 py-1 active:cursor-grabbing" onPointerDown={startDrag}>
          <GripHorizontal size={14} className="text-slate-500" />
          <span className="min-w-0 flex-1 truncate px-1 text-xs font-medium">{ref.name}</span>
          <span onPointerDown={(e) => e.stopPropagation()} className="flex items-center">
            {MODES.map((m) => (
              <IconBtn key={m.id} title={m.label} active={pip.mode === m.id} onClick={() => setPip({ mode: m.id })} className="h-7 w-7">
                {m.icon}
              </IconBtn>
            ))}
            <IconBtn title="吸管：點圖片取色" active={pip.eyedropper} onClick={() => setPip({ eyedropper: !pip.eyedropper })} className="h-7 w-7">
              <Pipette size={15} />
            </IconBtn>
            <IconBtn title="關閉" onClick={() => setPip({ open: false })} className="h-7 w-7">
              <X size={15} />
            </IconBtn>
          </span>
        </div>

        {pip.mode === 'pip' || pip.eyedropper ? (
          <div className="bg-slate-950/60">
            <img
              src={ref.url}
              alt={ref.name}
              draggable={false}
              className={cx('max-h-[38vh] w-full object-contain', pip.eyedropper && 'cursor-crosshair')}
              onClick={(e) => {
                if (!pip.eyedropper) return
                const c = sampleColor(e)
                if (c) useUi.getState().setPickedColor(c)
              }}
            />
          </div>
        ) : (
          <p className="px-3 py-2 text-[11px] text-slate-400">
            {pip.mode === 'onion' ? '參考圖已疊在 3D 畫面上，調整透明度對照配色與比例。' : '拖曳畫面中線，左側為參考圖、右側為 3D。'}
          </p>
        )}

        {pip.mode === 'onion' && (
          <div className="px-3 pb-2" onPointerDown={(e) => e.stopPropagation()}>
            <Slider label="參考圖透明度" value={pip.opacity} min={0.05} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setPip({ opacity: v })} />
          </div>
        )}

        {(pip.eyedropper || picked) && (
          <div className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
            <span className="h-6 w-6 shrink-0 rounded border border-white/30" style={{ background: picked ?? 'transparent' }} />
            <span className="flex-1 font-mono text-xs uppercase">{picked ?? '點圖片取色…'}</span>
            {picked && (
              <>
                <IconBtn title="複製色碼" className="h-7 w-7" onClick={() => navigator.clipboard?.writeText(picked)}>
                  <Copy size={14} />
                </IconBtn>
                <button
                  onClick={() => applyColorToSelection(picked)}
                  className="flex items-center gap-1 rounded-md bg-sky-500 px-2 py-1 text-xs font-medium text-white hover:bg-sky-400"
                  title="套用到目前選取的牆壁 / 地板 / 家具"
                >
                  <Wand2 size={13} /> 套用到選取
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
