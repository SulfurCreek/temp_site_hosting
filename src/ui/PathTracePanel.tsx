import { Camera, Download, Sparkles, X } from 'lucide-react'
import { useUi } from '../store/uiStore'
import { IconBtn, Segmented } from './controls'

const SAMPLE_OPTIONS = [128, 256, 512, 1024]

/** 頂部工具列按鈕：切換「相片級算圖模式」（靜態高畫質檢視） */
export function StudioButton() {
  const studio = useUi((s) => s.studio)
  const set = useUi((s) => s.setStudio)
  return (
    <button
      title="相片級算圖模式：dpr 2、8x MSAA、2048 陰影、柔化陰影、N8AO ultra，可匯出 4K PNG"
      onClick={() => set(!studio)}
      className={
        'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold shadow hover:brightness-110 ' +
        (studio ? 'bg-gradient-to-r from-amber-500 to-rose-500 text-white' : 'bg-slate-700/70 text-amber-200')
      }
    >
      <Sparkles size={15} />
      相片級算圖模式
    </button>
  )
}

/** 算圖模式開啟時的浮動工具列：匯出 4K PNG、（桌面）進階路徑追蹤 */
export function StudioBar({ mobile }: { mobile?: boolean }) {
  const studio = useUi((s) => s.studio)
  const pt = useUi((s) => s.pt.active)
  const exporting = useUi((s) => s.exporting)
  const request = useUi((s) => s.requestExport)
  const setStudio = useUi((s) => s.setStudio)
  const setPt = useUi((s) => s.setPt)
  if (!studio || pt) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3 max-lg:top-[64px]">
      <div className="glass pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs text-slate-100">
        <span className="flex items-center gap-1 font-semibold text-amber-300">
          <Sparkles size={14} /> 相片級算圖
        </span>
        <button
          disabled={exporting}
          onClick={request}
          className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
        >
          <Camera size={15} />
          {exporting ? '輸出中…' : mobile ? '匯出 PNG' : '匯出 4K 無損 PNG'}
        </button>
        {!mobile && (
          <button
            title="進階：用 GPU 路徑追蹤漸進式渲染目前視角（真實全域光照，較慢、需較強顯卡）"
            onClick={() => {
              useUi.getState().select(null)
              setPt({ active: true, samples: 0, status: 'idle' })
            }}
            className="rounded-lg bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20"
          >
            路徑追蹤（進階）
          </button>
        )}
        <IconBtn title="離開算圖模式，回到即時模式" onClick={() => setStudio(false)}>
          <X size={16} />
        </IconBtn>
      </div>
    </div>
  )
}

/** 渲染中的覆蓋層：鎖定相機互動，顯示進度、取樣數、下載與離開 */
export function PathTraceOverlay() {
  const pt = useUi((s) => s.pt)
  const set = useUi((s) => s.setPt)
  if (!pt.active) return null
  const pct = Math.min(100, Math.round((pt.samples / pt.target) * 100))
  const label =
    pt.status === 'building' ? '建立光線加速結構中…' : pt.status === 'error' ? '此裝置不支援路徑追蹤' : pt.status === 'done' ? '渲染完成' : '渲染中…'
  return (
    <div className="absolute inset-0 z-30 cursor-wait" onContextMenu={(e) => e.preventDefault()}>
      <div className="glass pointer-events-auto absolute bottom-4 left-1/2 flex w-[min(92vw,640px)] -translate-x-1/2 flex-col gap-2 rounded-2xl p-3 text-xs text-slate-100">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{label}</span>
          <span className="tabular-nums text-slate-300">
            {pt.samples} / {pt.target} 次取樣
          </span>
          <span className="flex-1" />
          <IconBtn title="離開高品質渲染，回到即時模式" onClick={() => set({ active: false })}>
            <X size={17} />
          </IconBtn>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-gradient-to-r from-amber-400 to-rose-400 transition-[width]" style={{ width: pct + '%' }} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5">
            品質
            <Segmented
              value={pt.target}
              onChange={(target) => set({ target, status: pt.samples >= target ? 'done' : 'rendering' })}
              options={SAMPLE_OPTIONS.map((n) => ({ value: n, label: String(n), title: `累積到 ${n} 次取樣（越多越乾淨、越久）` }))}
            />
          </label>
          <label className="flex items-center gap-1.5">
            解析度
            <Segmented
              value={pt.scale}
              onChange={(scale) => {
                set({ scale, samples: 0, status: 'building' })
                // 重新進入以套用新解析度
                set({ active: false })
                setTimeout(() => set({ active: true, scale }), 50)
              }}
              options={[
                { value: 0.5, label: '半' },
                { value: 1, label: '全' },
              ]}
            />
          </label>
          <span className="flex-1" />
          <button
            disabled={pt.samples < 1}
            onClick={() => set({ saveNonce: pt.saveNonce + 1 })}
            className="flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 font-semibold text-white hover:bg-sky-400 disabled:opacity-40"
          >
            <Download size={15} />
            下載 PNG
          </button>
        </div>
      </div>
    </div>
  )
}
