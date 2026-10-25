import {
  Box,
  Download,
  Eye,
  Footprints,
  Lightbulb,
  MapPin,
  HelpCircle,
  Move3d,
  PanelLeft,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Trash,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { VIEW_PRESETS } from '../scene/CameraRig'
import { cycleView, exportLayout, importLayoutFile, resetLayout } from '../store/actions'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import type { Kelvin, ViewPreset } from '../types'
import { IconBtn, Segmented, Toggle, cx } from './controls'
import { VantageButtons } from './FirstPersonBar'
import { enterFirstPerson } from '../scene/FirstPerson'

const KELVINS: { k: Kelvin; label: string; dot: string }[] = [
  { k: 3000, label: '3000K 黃光', dot: '#ffb46b' },
  { k: 4000, label: '4000K 自然光', dot: '#fff1d9' },
  { k: 6000, label: '6000K 白光', dot: '#dbe9ff' },
]

export function ViewButtons({ compact }: { compact?: boolean }) {
  const current = useUi((s) => s.currentView)
  const request = useUi((s) => s.requestView)
  return (
    <div className="inline-flex shrink-0 gap-0.5 rounded-lg border border-white/10 bg-slate-800/60 p-0.5">
      {(Object.keys(VIEW_PRESETS) as ViewPreset[]).map((v) => (
        <button
          key={v}
          title={v === 'TOP' ? '正上方 2D 平面圖' : `${VIEW_PRESETS[v].label}角（世紀帝國視角）`}
          onClick={() => request(v)}
          className={cx(
            'shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
            compact && 'px-2',
            current === v ? 'bg-sky-500 text-white' : 'text-slate-300 hover:bg-white/10',
          )}
        >
          {VIEW_PRESETS[v].label}
        </button>
      ))}
    </div>
  )
}

export function ProjectionToggle() {
  const p = useLayout((s) => s.settings.projection)
  const set = useLayout((s) => s.setSettings)
  return (
    <Segmented
      value={p}
      onChange={(projection) => set({ projection })}
      options={[
        { value: 'ortho', label: '正交', title: '正交相機：無近大遠小，方便看動線與比例' },
        { value: 'persp', label: '透視', title: '透視相機：檢視空間壓迫感' },
      ]}
    />
  )
}

export function CutawayToggle() {
  const c = useLayout((s) => s.settings.cutaway)
  const set = useLayout((s) => s.setSettings)
  return (
    <Segmented
      value={c}
      onChange={(cutaway) => set({ cutaway })}
      options={[
        { value: 'lower', label: '矮牆', title: '擋住視線的外牆降為 30 cm' },
        { value: 'ghost', label: '透明', title: '擋住視線的外牆變半透明' },
        { value: 'off', label: '不破牆' },
      ]}
    />
  )
}

export function LightToggle() {
  const k = useLayout((s) => s.settings.kelvin)
  const set = useLayout((s) => s.setSettings)
  return (
    <div className="inline-flex shrink-0 gap-0.5 rounded-lg border border-white/10 bg-slate-800/60 p-0.5">
      {KELVINS.map((x) => (
        <button
          key={x.k}
          title={x.label}
          onClick={() => set({ kelvin: x.k })}
          className={cx(
            'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
            k === x.k ? 'bg-sky-500 text-white' : 'text-slate-300 hover:bg-white/10',
          )}
        >
          <span className="h-2.5 w-2.5 rounded-full border border-black/20" style={{ background: x.dot }} />
          {x.k / 1000}K
        </button>
      ))}
    </div>
  )
}

export function ToolToggle() {
  const t = useLayout((s) => s.settings.tool)
  const set = useLayout((s) => s.setSettings)
  return (
    <Segmented
      value={t}
      onChange={(tool) => set({ tool })}
      options={[
        { value: 'drag', label: '拖拉', title: '直接拖拉家具（地面吸附）' },
        { value: 'move', label: '位移軸', title: 'TransformControls 位移' },
        { value: 'rotate', label: '旋轉環', title: 'TransformControls 旋轉（15° 吸附）' },
      ]}
    />
  )
}

export function SnapSelect() {
  const s = useLayout((st) => st.settings.snap)
  const set = useLayout((st) => st.setSettings)
  return (
    <Segmented
      value={s}
      onChange={(snap) => set({ snap })}
      options={[
        { value: 0, label: '自由' },
        { value: 0.01, label: '1cm' },
        { value: 0.05, label: '5cm' },
        { value: 0.1, label: '10cm' },
      ]}
    />
  )
}

export function MepToggle({ label = true }: { label?: boolean }) {
  const on = useLayout((s) => s.settings.showMep)
  const set = useLayout((s) => s.setSettings)
  return (
    <button
      title="顯示水電 / 燈具（MEP View）"
      onClick={() => set({ showMep: !on })}
      className={cx(
        'flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium transition-colors',
        on ? 'bg-amber-400 text-slate-900' : 'border border-white/10 bg-slate-800/60 text-slate-200 hover:bg-white/10',
      )}
    >
      <Zap size={15} />
      {label && 'MEP'}
    </button>
  )
}

export function HistoryButtons() {
  const undo = useLayout((s) => s.undo)
  const redo = useLayout((s) => s.redo)
  const canUndo = useLayout((s) => s.past.length > 0)
  const canRedo = useLayout((s) => s.future.length > 0)
  return (
    <>
      <IconBtn title="復原 (Ctrl+Z)" onClick={undo} disabled={!canUndo}>
        <RotateCcw size={17} />
      </IconBtn>
      <IconBtn title="重做 (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}>
        <RotateCw size={17} />
      </IconBtn>
    </>
  )
}

export function FileButtons() {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) importLayoutFile(f)
        }}
      />
      <IconBtn title="匯入 layout.json" onClick={() => input.current?.click()}>
        <Upload size={17} />
      </IconBtn>
      <IconBtn title="匯出 / 儲存 layout.json (Ctrl+S)" onClick={exportLayout}>
        <Download size={17} />
      </IconBtn>
      <IconBtn title="還原預設格局" onClick={resetLayout}>
        <Trash size={17} />
      </IconBtn>
    </>
  )
}

const Divider = () => <span className="mx-1 hidden h-6 w-px bg-white/10 xl:block" />

/* -------------------------------- 桌面版 -------------------------------- */

export function DesktopTopBar() {
  const name = useLayout((s) => s.layout.name)
  const setName = useLayout((s) => s.setName)
  const leftOpen = useUi((s) => s.leftOpen)
  const setLeftOpen = useUi((s) => s.setLeftOpen)
  const hud = useLayout((s) => s.settings.showHud)
  const set = useLayout((s) => s.setSettings)
  const fp = useUi((s) => s.viewMode) === 'firstPerson'

  return (
    <header className="glass relative z-40 flex h-14 shrink-0 items-center gap-2 border-x-0 border-t-0 px-3 text-slate-100">
      <IconBtn title={leftOpen ? '收合左側抽屜' : '展開左側抽屜'} active={leftOpen} onClick={() => setLeftOpen(!leftOpen)}>
        <PanelLeft size={18} />
      </IconBtn>
      <div className="flex items-center gap-2 pr-2">
        <Box className="text-sky-400" size={20} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-36 truncate rounded bg-transparent px-1 py-0.5 text-sm font-semibold outline-none focus:bg-white/10"
          aria-label="專案名稱"
        />
      </div>
      <div className="scroll-thin flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1">
        <VantageButtons />
        <Divider />
        {!fp && (
          <>
            <ViewButtons />
            <ProjectionToggle />
            <Divider />
            <CutawayToggle />
          </>
        )}
        <LightToggle />
        <Divider />
        {!fp && (
          <>
            <ToolToggle />
            <SnapSelect />
            <Divider />
          </>
        )}
        <MepToggle />
      </div>
      <div className="flex items-center gap-0.5">
        <HistoryButtons />
        <span className="mx-1 h-6 w-px bg-white/10" />
        <FileButtons />
        <IconBtn title="操作提示" active={hud} onClick={() => set({ showHud: !hud })}>
          <HelpCircle size={17} />
        </IconBtn>
      </div>
    </header>
  )
}

/* -------------------------------- 手機 / 平板 -------------------------------- */

/** 手機頂部膠囊列的單顆按鈕：圖示 + 10px 標籤 */
function PillBtn({
  icon,
  label,
  active,
  disabled,
  onClick,
  title,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
}) {
  return (
    <button
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'flex h-10 min-w-[46px] shrink-0 flex-col items-center justify-center gap-px rounded-full px-1.5 transition-colors',
        active ? 'bg-sky-500 text-white' : 'text-slate-200 active:bg-white/15',
        disabled && 'opacity-35',
      )}
    >
      {icon}
      <span className="text-[10px] leading-3 whitespace-nowrap">{label}</span>
    </button>
  )
}

export function MobileTopBar() {
  const [more, setMore] = useState(false)
  const current = useUi((s) => s.currentView)
  const viewMode = useUi((s) => s.viewMode)
  const placing = useUi((s) => s.placing)
  const setViewMode = useUi((s) => s.setViewMode)
  const setPlacing = useUi((s) => s.setPlacing)
  const showMep = useLayout((s) => s.settings.showMep)
  const set = useLayout((s) => s.setSettings)
  const kelvin = useLayout((s) => s.settings.kelvin)
  const fp = viewMode === 'firstPerson'
  const nextKelvin = () => set({ kelvin: kelvin === 3000 ? 4000 : kelvin === 4000 ? 6000 : 3000 })
  const dot = KELVINS.find((x) => x.k === kelvin)!.dot

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex max-w-full items-center gap-0.5 rounded-full border border-white/10 bg-black/60 px-2 py-1 text-slate-100 backdrop-blur-md">
          <PillBtn
            title={fp ? '回到俯視' : '第一人稱'}
            icon={fp ? <Box size={16} /> : <Footprints size={16} className="text-sky-300" />}
            label={fp ? '俯視' : '第一人稱'}
            active={fp}
            onClick={() => (fp ? setViewMode('isometric') : enterFirstPerson())}
          />
          <PillBtn
            title="放置立足點"
            icon={<MapPin size={16} className={placing ? '' : 'text-sky-300'} />}
            label="立足點"
            active={placing}
            onClick={() => (fp ? setViewMode('isometric') : setPlacing(!placing))}
          />
          <PillBtn
            title="切換俯視方位"
            icon={<Eye size={16} className="text-sky-300" />}
            label={fp ? '方位' : current ? VIEW_PRESETS[current].label : '自由'}
            disabled={fp}
            onClick={cycleView}
          />
          <PillBtn
            title={`燈光色溫 ${kelvin}K`}
            icon={<span className="my-0.5 h-3.5 w-3.5 rounded-full border border-black/30" style={{ background: dot }} />}
            label={`${kelvin / 1000}K`}
            onClick={nextKelvin}
          />
          <PillBtn title="顯示水電 / 燈具" icon={<Zap size={16} className={showMep ? '' : 'text-amber-300'} />} label="水電" active={showMep} onClick={() => set({ showMep: !showMep })} />
          <PillBtn title="更多設定" icon={<SlidersHorizontal size={16} />} label="更多" onClick={() => setMore(true)} />
        </div>
      </div>
      {more && <MoreSheet onClose={() => setMore(false)} />}
    </>
  )
}

function MoreSheet({ onClose }: { onClose: () => void }) {
  const s = useLayout((st) => st.settings)
  const set = useLayout((st) => st.setSettings)
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="glass sheet-compact scroll-thin absolute inset-x-2 top-[max(0.5rem,env(safe-area-inset-top))] max-h-[85dvh] space-y-4 overflow-y-auto rounded-2xl p-4 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Move3d size={16} className="text-sky-300" /> 檢視與操作設定
          </h3>
          <IconBtn title="關閉" onClick={onClose}>
            <X size={18} />
          </IconBtn>
        </div>
        <Row label="復原 / 重做">
          <div className="flex gap-1">
            <HistoryButtons />
          </div>
        </Row>
        <Row label="視角">
          <ViewButtons compact />
        </Row>
        <Row label="相機">
          <ProjectionToggle />
        </Row>
        <Row label="智慧破牆">
          <CutawayToggle />
        </Row>
        <Row label="燈光色溫">
          <LightToggle />
        </Row>
        <Row label="家具操作">
          <ToolToggle />
        </Row>
        <Row label="吸附格距">
          <SnapSelect />
        </Row>
        <Row label="燈光情境（等燈光系統合入後啟用）">
          <div className="flex gap-1">
            {['全開', '氛圍軌道燈', '夜燈', '白天'].map((x) => (
              <button key={x} disabled className="shrink-0 whitespace-nowrap rounded-lg border border-white/10 bg-slate-800/60 px-3 py-1.5 text-xs opacity-40">
                <Lightbulb size={12} className="mr-1 inline" />
                {x}
              </button>
            ))}
          </div>
        </Row>
        <Toggle label="景深 DoF（等相機串合入後啟用）" checked={false} disabled onChange={() => {}} />
        <Toggle label="顯示水電 / 燈具（MEP）" checked={s.showMep} onChange={(v) => set({ showMep: v })} />
        <Toggle label="顯示格線" checked={s.showGrid} onChange={(v) => set({ showGrid: v })} />
        <Toggle label="顯示操作提示" checked={s.showHud} onChange={(v) => set({ showHud: v })} />
        <Row label="專案檔">
          <div className="flex gap-1">
            <FileButtons />
          </div>
        </Row>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}
