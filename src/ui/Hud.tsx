import { X } from 'lucide-react'
import { useState } from 'react'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import { useIsMobile } from './hooks'

const Key = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-px font-mono text-[10px] text-slate-100">{children}</kbd>
)

/** 新手引導：畫面角落常駐的極簡操作提示 */
export function Hud() {
  const show = useLayout((s) => s.settings.showHud)
  const set = useLayout((s) => s.setSettings)
  const mobile = useIsMobile()
  const [dismissed, setDismissed] = useState(false)
  if (!show || dismissed) return null

  if (mobile)
    return (
      <div className="pointer-events-none absolute inset-x-0 top-[62px] z-20 flex justify-center px-3">
        <div className="glass pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pl-3.5 pr-2 text-[11px] text-slate-200">
          單指旋轉 · 雙指縮放平移 · 點選家具後拖拉移動
          <button aria-label="關閉提示" onClick={() => (setDismissed(true), set({ showHud: false }))} className="rounded-full p-1 text-slate-400 active:bg-white/10">
            <X size={13} />
          </button>
        </div>
      </div>
    )

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2">
      <div className="glass pointer-events-auto flex items-center gap-x-4 gap-y-1 rounded-full px-4 py-2 text-[11px] text-slate-300">
        <span>點擊物件拖拉移動</span>
        <span>
          <Key>R</Key> 旋轉 90°
        </span>
        <span>
          <Key>Backspace</Key> 刪除
        </span>
        <span>
          <Key>Space</Key> 切換視角
        </span>
        <span>右鍵平移 · 滾輪縮放</span>
        <button aria-label="關閉提示" onClick={() => set({ showHud: false })} className="-mr-1 rounded-full p-0.5 text-slate-500 hover:text-slate-200">
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

export function Toast() {
  const t = useUi((s) => s.toast)
  const mobile = useIsMobile()
  if (!t) return null
  return (
    <div className={`pointer-events-none absolute inset-x-0 z-50 flex justify-center px-4 ${mobile ? 'bottom-[150px]' : 'top-16'}`}>
      <div className="glass rounded-full px-4 py-2 text-xs text-slate-100 shadow-lg">{t}</div>
    </div>
  )
}
