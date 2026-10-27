import { useState } from 'react'
import { diagReport, getSafeLevel, resetSafeLevel, useDiag } from '../lib/diagnostics'

/** 渲染出問題時的提示：顯示原因並可一鍵複製報告（手機沒有 DevTools） */
export function DiagOverlay() {
  const items = useDiag((s) => s.items)
  const lost = useDiag((s) => s.contextLost)
  const postBroken = useDiag((s) => s.postBroken)
  const [open, setOpen] = useState(false)
  const safe = getSafeLevel()
  const debug = typeof location !== 'undefined' && /[?&]debug=1/.test(location.search)
  const bad = items.some((i) => i.kind !== 'info')
  if (!bad && !lost && !debug && !safe) return null
  return (
    <div className="absolute left-2 top-16 z-50 max-w-[calc(100%-1rem)] text-xs max-lg:top-[84px]">
      <button onClick={() => setOpen(!open)} className="glass rounded-full px-3 py-1.5 text-rose-300">
        {lost ? '畫面中斷（WebGL 記憶體不足）' : safe ? `已自動降低畫質（等級 ${safe}）` : postBroken ? '後製效果已自動關閉' : '渲染診斷'} · 點此查看
      </button>
      {open && (
        <div className="glass mt-2 max-h-[60dvh] overflow-auto rounded-xl p-3 text-slate-100">
          <pre className="whitespace-pre-wrap break-all text-[10px] leading-4">{diagReport()}</pre>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => navigator.clipboard?.writeText(diagReport()).catch(() => {})}
              className="rounded-lg bg-sky-500 px-3 py-1.5 font-medium text-white"
            >
              複製報告
            </button>
            {safe > 0 && (
              <button onClick={resetSafeLevel} className="rounded-lg border border-white/20 px-3 py-1.5">
                嘗試完整畫質
              </button>
            )}
            <button onClick={() => setOpen(false)} className="rounded-lg border border-white/20 px-3 py-1.5">
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
