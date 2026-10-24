import { X } from 'lucide-react'
import { MEP_ITEMS } from '../data'
import { MEP_COLOR, MEP_KIND_LABEL } from '../scene/Mep'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import type { MepKind } from '../types'
import { useIsMobile } from './hooks'

const LEGEND: MepKind[] = ['outlet', 'dedicated', 'weak', 'switch', 'water', 'track', 'ceiling', 'downlight']

/** MEP 圖例 + 點選標記後的資訊卡 */
export function MepInfo() {
  const show = useLayout((s) => s.settings.showMep)
  const id = useUi((s) => s.mepId)
  const select = useUi((s) => s.selectMep)
  const mobile = useIsMobile()
  if (!show) return null
  const it = MEP_ITEMS.find((m) => m.id === id)
  return (
    <>
      {!mobile && (
        <div className="glass pointer-events-none absolute right-4 top-4 z-10 rounded-xl px-3 py-2 text-[11px] text-slate-200">
          <div className="mb-1 font-semibold">水電 / 燈具（MEP）</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {LEGEND.map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: MEP_COLOR[k] }} />
                {MEP_KIND_LABEL[k]}
              </span>
            ))}
          </div>
        </div>
      )}
      {it && (
        <div
          className={`glass absolute z-30 w-[min(92vw,340px)] rounded-xl p-3 text-slate-100 shadow-2xl ${mobile ? 'bottom-[140px] left-1/2 -translate-x-1/2' : 'bottom-16 left-1/2 -translate-x-1/2'}`}
        >
          <div className="flex items-start gap-2">
            <i className="mt-1 inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: MEP_COLOR[it.kind] }} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{it.label}</div>
              <div className="mt-0.5 text-xs text-slate-300">{MEP_KIND_LABEL[it.kind]}</div>
            </div>
            <button aria-label="關閉" className="rounded p-1 text-slate-400 hover:text-white" onClick={() => select(null)}>
              <X size={15} />
            </button>
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-slate-300">
            <dt>{it.face ? '離地高度' : '安裝高度'}</dt>
            <dd className="text-slate-100">H:{Math.round(it.h * 100)} cm</dd>
            <dt>位置</dt>
            <dd className="text-slate-100">
              X {Math.round(it.at[0] * 100)} / Z {Math.round(it.at[1] * 100)} cm
            </dd>
            {it.length && (
              <>
                <dt>長度</dt>
                <dd className="text-slate-100">
                  {Math.round(it.length * 100)} cm{it.heads ? `・${it.heads} 燈頭` : ''}
                </dd>
              </>
            )}
            {it.diameter && (
              <>
                <dt>直徑</dt>
                <dd className="text-slate-100">{Math.round(it.diameter * 100)} cm</dd>
              </>
            )}
            <dt>圖面來源</dt>
            <dd className="text-slate-100">{it.src || '—'}</dd>
          </dl>
          {it.assumed && <p className="mt-2 text-[11px] text-amber-300">※ 位置或高度為依圖面推估，施工前請現場確認。</p>}
        </div>
      )}
    </>
  )
}
