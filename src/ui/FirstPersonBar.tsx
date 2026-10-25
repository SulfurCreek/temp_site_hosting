import { useEffect, useState } from 'react'
import { Box, Footprints, LogOut } from 'lucide-react'
import { hFovOf, responsiveVFov } from '../lib/useResponsiveFOV'
import { enterFirstPerson, goHotspot, useHotspots } from '../scene/FirstPerson'
import { useUi } from '../store/uiStore'
import type { EyeMode } from '../types'
import { cx, Segmented } from './controls'
import { useIsMobile } from './hooks'

/** 俯視 ⇄ 第一人稱 + 📍 放置立足點（桌面頂部工具列 / 手機設定面板共用） */
export function VantageButtons() {
  const viewMode = useUi((s) => s.viewMode)
  const placing = useUi((s) => s.placing)
  const setViewMode = useUi((s) => s.setViewMode)
  const setPlacing = useUi((s) => s.setPlacing)
  const fp = viewMode === 'firstPerson'
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Segmented
        value={viewMode}
        onChange={(m) => (m === 'firstPerson' ? enterFirstPerson() : setViewMode('isometric'))}
        options={[
          { value: 'isometric', label: '俯視', title: '世紀帝國俯視模式（正交相機 + 智慧破牆）' },
          { value: 'firstPerson', label: '第一人稱', title: '立足點人眼模式：透視相機、完整牆面與天花板' },
        ]}
      />
      <button
        title="在地板上點一下放置立足點；按住拖曳可決定視線方向"
        onClick={() => (fp ? setViewMode('isometric') : setPlacing(!placing))}
        className={cx(
          'flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition-colors',
          placing ? 'bg-sky-500 text-white' : 'border border-white/10 bg-slate-800/60 text-slate-200 hover:bg-white/10',
        )}
      >
        📍 {fp ? '放置立足點（回俯視）' : '放置立足點'}
      </button>
    </div>
  )
}

const EYES: { value: EyeMode; label: string; title: string }[] = [
  { value: 'stand', label: '站立', title: '站立視角（預設 165 cm，可調 150–185）' },
  { value: 'sit', label: '坐姿 110', title: '坐姿視角 110 cm：坐沙發看電視牆插座、坐床上看電視' },
  { value: 'robot', label: '掃地機 30', title: '掃地機 / 寵物視角 30 cm：檢查櫃體下方懸空與插座走線' },
]

/** 目前視窗長寬比下實際使用的垂直 / 水平視角（與 useResponsiveFOV 同一公式） */
function useViewportFov(base: number) {
  const [wh, setWh] = useState(() => [window.innerWidth, window.innerHeight])
  useEffect(() => {
    const on = () => setWh([window.innerWidth, window.innerHeight])
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const aspect = wh[0] / Math.max(wh[1], 1)
  const v = responsiveVFov(aspect, base)
  return { auto: v > base + 0.5, v: Math.round(v), h: Math.round(hFovOf(v, aspect)) }
}

/** 第一人稱底部浮動列：預設立足點 + 人眼高度切換 + 視角 FOV */
export function FirstPersonBar() {
  const mobile = useIsMobile()
  const eye = useUi((s) => s.eye)
  const standCm = useUi((s) => s.standCm)
  const fov = useUi((s) => s.fov)
  const setEye = useUi((s) => s.setEye)
  const setStandCm = useUi((s) => s.setStandCm)
  const setFov = useUi((s) => s.setFov)
  const backoffCm = useUi((s) => s.backoffCm)
  const setBackoffCm = useUi((s) => s.setBackoffCm)
  const vfov = useViewportFov(fov)
  const setViewMode = useUi((s) => s.setViewMode)
  const hotspots = useHotspots()

  return (
    <div
      className={cx(
        'pointer-events-none absolute inset-x-0 z-30 flex justify-center px-2',
        mobile ? 'bottom-[max(0.5rem,env(safe-area-inset-bottom))]' : 'bottom-3',
      )}
    >
      <div className="glass pointer-events-auto flex w-full max-w-[920px] flex-col gap-2 rounded-2xl p-2.5 text-slate-100">
        {hotspots.length > 0 && (
          <div className="scroll-thin -mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5">
            {hotspots.map((h, i) => (
              <button
                key={h.id}
                title={h.note}
                onClick={() => goHotspot(h)}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-sky-500/80 hover:text-white active:bg-sky-500"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-400/90 text-[10px] font-bold text-slate-900">{i + 1}</span>
                {h.name}
                {h.estimated && <span className="text-[10px] text-amber-300">估</span>}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Segmented value={eye} onChange={setEye} options={EYES} />
          <label className={cx('flex items-center gap-2 text-[11px] text-slate-300', eye !== 'stand' && 'opacity-40')}>
            站立高度
            <input
              type="range"
              min={150}
              max={185}
              step={1}
              value={standCm}
              disabled={eye !== 'stand'}
              onChange={(e) => setStandCm(+e.target.value)}
              className="w-24 accent-sky-400"
            />
            <span className="w-10 tabular-nums text-slate-100">{standCm} cm</span>
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            視角
            <input type="range" min={50} max={90} step={1} value={fov} onChange={(e) => setFov(+e.target.value)} className="w-20 accent-sky-400" />
            <span className="w-8 tabular-nums text-slate-100">{fov}°</span>
            {vfov.auto && (
              <span className="text-[10px] text-sky-300" title="直向螢幕自動放大垂直視角，水平視角維持超廣角">
                自動廣角 H{vfov.h}°
              </span>
            )}
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-300" title="相機從立足點沿視線反方向退後，背後 80 cm 內的牆與櫃體會自動隱藏">
            退後
            <input type="range" min={0} max={60} step={5} value={backoffCm} onChange={(e) => setBackoffCm(+e.target.value)} className="w-20 accent-sky-400" />
            <span className="w-10 tabular-nums text-slate-100">{backoffCm} cm</span>
          </label>
          <button
            onClick={() => setViewMode('isometric')}
            className="ml-auto flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-slate-800/70 px-2.5 text-xs font-medium text-slate-200 hover:bg-white/10"
            title="回到俯視（Esc）"
          >
            <LogOut size={14} /> 回俯視
          </button>
        </div>
        {!mobile && (
          <div className="text-[11px] text-slate-400">
            拖曳畫面原地環視 · 點地板走過去 · 方向鍵轉頭 · Esc 回俯視
          </div>
        )}
      </div>
    </div>
  )
}

/** 手機頂部精簡按鈕：切換第一人稱 / 放置立足點 */
export function MobileVantageButtons() {
  const viewMode = useUi((s) => s.viewMode)
  const placing = useUi((s) => s.placing)
  const setViewMode = useUi((s) => s.setViewMode)
  const setPlacing = useUi((s) => s.setPlacing)
  const fp = viewMode === 'firstPerson'
  return (
    <>
      <button
        onClick={() => (fp ? setViewMode('isometric') : enterFirstPerson())}
        className={cx('flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold active:bg-white/15', fp && 'bg-sky-500 text-white')}
        title={fp ? '回到俯視' : '第一人稱'}
      >
        {fp ? <Box size={15} /> : <Footprints size={15} className="text-sky-300" />}
        {fp ? '俯視' : '第一人稱'}
      </button>
      {!fp && (
        <button
          onClick={() => setPlacing(!placing)}
          className={cx('flex h-9 items-center rounded-full px-2.5 text-xs font-semibold active:bg-white/15', placing && 'bg-sky-500 text-white')}
          title="放置立足點"
        >
          📍
        </button>
      )}
    </>
  )
}
