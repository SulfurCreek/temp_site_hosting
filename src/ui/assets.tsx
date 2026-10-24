import { Box, Upload } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { cropToDataUrl, fileToDataUrl, loadImage } from '../lib/image'
import { useUi } from '../store/uiStore'
import { Btn, cx } from './controls'
import { useManifest, type ManifestEntry } from './hooks'

/** 隱藏 input 的上傳按鈕。圖片會先縮圖再轉 data URL。 */
export function UploadButton({
  onUrl,
  onFile,
  label = '上傳圖片',
  accept = 'image/*',
  maxSize,
  icon,
  className,
}: {
  onUrl?: (url: string, file: File) => void
  onFile?: (file: File) => void
  label?: string
  accept?: string
  maxSize?: number
  icon?: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            if (onFile) onFile(f)
            else if (onUrl) onUrl(await fileToDataUrl(f, maxSize), f)
          } catch (err) {
            useUi.getState().showToast((err as Error).message)
          }
        }}
      />
      <Btn onClick={() => ref.current?.click()} className={className}>
        {icon ?? <Upload size={14} />}
        {label}
      </Btn>
    </>
  )
}

/** 顯示 public/inputs/<kind>/ 內的檔案縮圖，點擊即選用 */
export function AssetGrid({
  kind,
  onPick,
  models = false,
  activeUrl,
  empty,
}: {
  kind: 'floorplans' | 'references' | 'products'
  onPick: (e: ManifestEntry) => void
  models?: boolean
  activeUrl?: string
  empty?: string
}) {
  const manifest = useManifest()
  const items = manifest[kind].filter((e) => models || e.kind === 'image')
  if (!items.length)
    return (
      <p className="rounded-md border border-dashed border-white/15 p-3 text-xs leading-relaxed text-slate-500">
        {empty ?? `public/inputs/${kind}/ 內尚無檔案。把圖片放進去後重新整理即可在此選用。`}
      </p>
    )
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((e) => (
        <button
          key={e.url}
          title={e.name}
          onClick={() => onPick(e)}
          className={cx(
            'group overflow-hidden rounded-md border bg-slate-800 text-left transition',
            activeUrl === e.url ? 'border-sky-400 ring-1 ring-sky-400' : 'border-white/10 hover:border-white/30',
          )}
        >
          <div className="flex aspect-square items-center justify-center bg-[repeating-conic-gradient(#1e293b_0%_25%,#273449_0%_50%)] bg-[length:12px_12px]">
            {e.kind === 'image' ? (
              <img src={e.url} alt={e.name} className="h-full w-full object-contain" draggable={false} />
            ) : (
              <Box className="text-slate-400" />
            )}
          </div>
          <div className="truncate px-1.5 py-1 text-[10px] text-slate-300">{e.name}</div>
        </button>
      ))}
    </div>
  )
}

/** 圖片裁切視窗：拖曳框選區域（預設 1:1，適合做材質貼皮） */
export function CropModal({
  src,
  onDone,
  onCancel,
  title = '裁切材質',
}: {
  src: string
  onDone: (dataUrl: string) => void
  onCancel: () => void
  title?: string
}) {
  const imgRef = useRef<HTMLImageElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [square, setSquare] = useState(true)
  const start = useRef<{ x: number; y: number } | null>(null)

  const local = (e: React.PointerEvent) => {
    const b = imgRef.current!.getBoundingClientRect()
    return {
      x: Math.min(b.width, Math.max(0, e.clientX - b.left)),
      y: Math.min(b.height, Math.max(0, e.clientY - b.top)),
      bw: b.width,
      bh: b.height,
    }
  }

  const update = (e: React.PointerEvent) => {
    const s = start.current
    if (!s) return
    const p = local(e)
    let w = p.x - s.x
    let h = p.y - s.y
    if (square) {
      const m = Math.min(Math.abs(w), Math.abs(h))
      w = Math.sign(w || 1) * m
      h = Math.sign(h || 1) * m
    }
    setRect({ x: Math.min(s.x, s.x + w), y: Math.min(s.y, s.y + h), w: Math.abs(w), h: Math.abs(h) })
  }

  const apply = async () => {
    const img = imgRef.current
    if (!img) return
    const full = await loadImage(src)
    const k = full.naturalWidth / img.clientWidth
    const r = rect && rect.w > 6 && rect.h > 6 ? rect : { x: 0, y: 0, w: img.clientWidth, h: img.clientHeight }
    onDone(cropToDataUrl(full, { x: r.x * k, y: r.y * k, w: r.w * k, h: r.h * k }))
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-950/90 p-3 backdrop-blur-sm sm:p-6" onPointerDown={(e) => e.stopPropagation()}>
      <div className="mb-2 flex items-center gap-3 text-slate-100">
        <h3 className="flex-1 text-sm font-semibold">{title}：拖曳框選要當作材質的區域</h3>
        <label className="flex items-center gap-1.5 text-xs text-slate-300">
          <input type="checkbox" checked={square} onChange={(e) => setSquare(e.target.checked)} />
          鎖定正方形
        </label>
        <Btn onClick={() => setRect(null)}>整張</Btn>
        <Btn onClick={onCancel}>取消</Btn>
        <Btn variant="primary" onClick={apply}>
          套用
        </Btn>
      </div>
      <div ref={boxRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div className="relative inline-block max-h-full max-w-full touch-none">
          <img
            ref={imgRef}
            src={src}
            alt="crop source"
            draggable={false}
            className="block max-h-[calc(100vh-110px)] max-w-full select-none"
            onPointerDown={(e) => {
              ;(e.target as Element).setPointerCapture(e.pointerId)
              const p = local(e)
              start.current = { x: p.x, y: p.y }
              setRect({ x: p.x, y: p.y, w: 0, h: 0 })
            }}
            onPointerMove={update}
            onPointerUp={() => (start.current = null)}
          />
          {rect && (
            <div
              className="pointer-events-none absolute border-2 border-sky-400 bg-sky-400/10 shadow-[0_0_0_9999px_rgba(2,6,23,0.55)]"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
