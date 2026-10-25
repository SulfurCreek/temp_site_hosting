import { LogOut } from 'lucide-react'
import { useUi } from '../store/uiStore'
import type { EyeMode } from '../types'
import { Segmented } from './controls'
import { useIsMobile } from './hooks'

const EYES: { value: EyeMode; label: string; title: string }[] = [
  { value: 'stand', label: '站立', title: '站立視角 168 cm' },
  { value: 'sit', label: '坐姿', title: '坐姿視角 110 cm：坐沙發看電視牆、坐床上看電視' },
  { value: 'robot', label: '低視角', title: '掃地機 / 寵物視角 30 cm：檢查櫃體下方懸空與插座走線' },
]

/** 第一人稱底部浮動列：人眼高度 + 回俯視。拖曳環視、點地板走過去，沒有任何立足點設定 */
export function FirstPersonBar() {
  const mobile = useIsMobile()
  const eye = useUi((s) => s.eye)
  const setEye = useUi((s) => s.setEye)
  const setViewMode = useUi((s) => s.setViewMode)
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="glass pointer-events-auto flex flex-col items-center gap-1.5 rounded-2xl p-2 text-slate-100">
        <div className="flex items-center gap-2">
          <Segmented value={eye} onChange={setEye} options={EYES} />
          <button
            onClick={() => setViewMode('isometric')}
            className="flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-slate-800/70 px-2.5 text-xs font-medium text-slate-200 hover:bg-white/10"
            title="回到俯視（Esc）"
          >
            <LogOut size={14} /> 俯視
          </button>
        </div>
        {!mobile && <div className="text-[11px] text-slate-400">拖曳畫面環視 · 點地板走過去 · 方向鍵轉頭 · Esc 回俯視</div>}
      </div>
    </div>
  )
}
