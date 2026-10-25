import { LogOut, SlidersHorizontal } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFxTier } from '../lib/fx'
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
/** 單行可橫向滑動的立足點膠囊（手機：俯視 / 第一人稱共用；點選即進入該立足點的第一人稱） */
export function VantageChips({ className }: { className?: string }) {
  const hotspots = useHotspots()
  if (!hotspots.length) return null
  return (
    <div className={cx('no-scrollbar pointer-events-auto flex gap-1.5 overflow-x-auto whitespace-nowrap px-2 py-1 text-xs', className)}>
      {hotspots.map((h) => (
        <button
          key={h.id}
          title={h.note}
          onClick={() => goHotspot(h)}
          className="shrink-0 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 font-medium text-slate-100 backdrop-blur-md active:bg-sky-500"
        >
          📍{h.name}
          {h.estimated && <span className="ml-0.5 text-[10px] text-amber-300">估</span>}
        </button>
      ))}
    </div>
  )
}

function MobileFirstPersonBar() {
  const [adjust, setAdjust] = useState(false)
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
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <VantageChips />
      <div className="pointer-events-auto mx-2 flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-black/60 p-1.5 text-slate-100 backdrop-blur-md">
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
            <Segmented value={eye} onChange={setEye} options={EYES.map((e) => ({ ...e, label: e.label.replace(' ', '') }))} />
          </div>
          <button
            onClick={() => setAdjust(!adjust)}
            aria-label="視角與高度"
            className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', adjust ? 'bg-sky-500 text-white' : 'bg-white/10')}
          >
            <SlidersHorizontal size={14} />
          </button>
          <button onClick={() => setViewMode('isometric')} aria-label="回俯視" className="flex h-8 shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 text-xs font-medium">
            <LogOut size={13} /> 俯視
          </button>
        </div>
        {adjust && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-slate-300">
            <label className={cx('flex basis-[45%] flex-1 items-center gap-1.5', eye !== 'stand' && 'opacity-40')}>
              高
              <input type="range" min={150} max={185} value={standCm} disabled={eye !== 'stand'} onChange={(e) => setStandCm(+e.target.value)} className="min-w-0 flex-1" />
              <span className="w-7 tabular-nums">{standCm}</span>
            </label>
            <label className="flex basis-[45%] flex-1 items-center gap-1.5">
              視角
              <input type="range" min={50} max={90} value={fov} onChange={(e) => setFov(+e.target.value)} className="min-w-0 flex-1" />
              <span className="w-6 tabular-nums">{vfov.auto ? `H${vfov.h}` : `${fov}°`}</span>
            </label>
            <label className="flex basis-[45%] flex-1 items-center gap-1.5">
              退後
              <input type="range" min={0} max={60} step={5} value={backoffCm} onChange={(e) => setBackoffCm(+e.target.value)} className="min-w-0 flex-1" />
              <span className="w-7 tabular-nums">{backoffCm}</span>
            </label>
          </div>
        )}
      </div>
    </div>
  )
}

export function FirstPersonBar() {
  const isMobile = useIsMobile()
  return isMobile ? <MobileFirstPersonBar /> : <DesktopFirstPersonBar />
}

function DesktopFirstPersonBar() {
  const eye = useUi((s) => s.eye)
  const standCm = useUi((s) => s.standCm)
  const fov = useUi((s) => s.fov)
  const setEye = useUi((s) => s.setEye)
  const setStandCm = useUi((s) => s.setStandCm)
  const setFov = useUi((s) => s.setFov)
  const backoffCm = useUi((s) => s.backoffCm)
  const setBackoffCm = useUi((s) => s.setBackoffCm)
  const vfov = useViewportFov(fov)
  const dof = useUi((s) => s.dof)
  const setDof = useUi((s) => s.setDof)
  const lowFx = useFxTier() === 'low'
  const setViewMode = useUi((s) => s.setViewMode)
  const hotspots = useHotspots()

  return (
    <div
      className={cx(
        'pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center px-2',
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
          {!lowFx && (
            <label className="flex items-center gap-1.5 text-[11px] text-slate-300" title="光學景深：以畫面中央的家具 / 牆面距離對焦（手機低品質模式不啟用）">
              <input type="checkbox" checked={dof} onChange={(e) => setDof(e.target.checked)} className="accent-sky-400" />
              景深
            </label>
          )}
          <button
            onClick={() => setViewMode('isometric')}
            className="ml-auto flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-white/10 bg-slate-800/70 px-2.5 text-xs font-medium text-slate-200 hover:bg-white/10"
            title="回到俯視（Esc）"
          >
            <LogOut size={14} /> 回俯視
          </button>
        </div>
        <div className="text-[11px] text-slate-400">拖曳畫面原地環視 · 點地板走過去 · 方向鍵轉頭 · Esc 回俯視</div>
      </div>
    </div>
  )
}
