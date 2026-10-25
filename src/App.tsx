import { PanelLeftOpen } from 'lucide-react'
import { useEffect } from 'react'
import { Scene } from './scene/Scene'
import { useLayout } from './store/layoutStore'
import { useUi } from './store/uiStore'
import { FirstPersonBar } from './ui/FirstPersonBar'
import { Hud, Toast } from './ui/Hud'
import { useIsMobile } from './ui/hooks'
import { BottomSheet, LeftDrawer, RightPanel } from './ui/Panels'
import { MepInfo } from './ui/MepInfo'
import { ReferenceViewer } from './ui/ReferenceViewer'
import { DesktopTopBar, MobileTopBar } from './ui/TopBar'
import { useHotkeys } from './ui/useHotkeys'

export default function App() {
  const mobile = useIsMobile()
  const leftOpen = useUi((s) => s.leftOpen)
  const setLeftOpen = useUi((s) => s.setLeftOpen)
  const selection = useUi((s) => s.selection)
  const calibActive = useUi((s) => s.calib.active)
  const moving = useUi((s) => s.moving)
  const fp = useUi((s) => s.viewMode) === 'firstPerson'
  const colorProof = useLayout((s) => !!s.settings.colorProof)
  const setSettings = useLayout((s) => s.setSettings)
  useHotkeys()

  // 手機：選取物件 → 底部抽屜切到「屬性」並以精簡高度顯示；取消選取 → 收起
  useEffect(() => {
    if (!mobile) return
    const ui = useUi.getState()
    if (selection) {
      if (ui.mobileTab !== 'props' || ui.sheet === 'closed') ui.openSheet('props', 'peek')
    } else if (ui.mobileTab === 'props') {
      ui.setSheet('closed')
    }
  }, [selection, mobile])

  // 比例尺校準時收起手機抽屜，讓出畫面
  useEffect(() => {
    if (mobile && calibActive) useUi.getState().setSheet('closed')
  }, [mobile, calibActive])

  // 第一人稱：手機收起底部抽屜讓出畫面
  useEffect(() => {
    if (mobile && fp) useUi.getState().setSheet('closed')
  }, [mobile, fp])

  return (
    <div className="flex h-[100dvh] w-screen select-none flex-col overflow-hidden bg-slate-900 text-slate-100">
      {!mobile && <DesktopTopBar />}
      <main className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <Scene />
        </div>
        <ReferenceViewer />
        {!fp && <Hud />}
        {fp && <FirstPersonBar />}
        <MepInfo />
        <Toast />
        {colorProof && (
          <div className="absolute inset-x-0 bottom-20 z-30 flex justify-center px-3">
            <button
              onClick={() => setSettings({ colorProof: false })}
              className="glass rounded-full px-4 py-2 text-xs text-amber-300 active:bg-white/10"
            >
              標準對色光開啟中（無燈具光源 / AO / 景深）· 點此關閉
            </button>
          </div>
        )}
        {moving && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3 max-lg:top-[72px]">
            <div className="glass rounded-full px-4 py-1.5 text-xs text-amber-300">移動模式：拖拉選取的物件到新位置（Enter / Esc 結束）</div>
          </div>
        )}
        {calibActive && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center">
            <div className="glass rounded-full px-4 py-1.5 text-xs text-amber-300">比例尺校準中：請在施工圖上點選兩點（Esc 取消）</div>
          </div>
        )}
        {mobile ? (
          <>
            <MobileTopBar />
            {!fp && <BottomSheet />}
          </>
        ) : (
          <>
            {!fp && <LeftDrawer />}
            {!leftOpen && !fp && (
              <button
                onClick={() => setLeftOpen(true)}
                className="glass absolute left-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-xl text-slate-200 hover:bg-white/10"
                title="展開左側抽屜"
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            {!fp && <RightPanel />}
          </>
        )}
      </main>
    </div>
  )
}
