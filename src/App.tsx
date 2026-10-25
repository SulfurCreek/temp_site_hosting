import { PanelLeftOpen } from 'lucide-react'
import { useEffect } from 'react'
import { Scene } from './scene/Scene'
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
  const placing = useUi((s) => s.placing)
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
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-slate-900 text-slate-100">
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
        {moving && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3 max-lg:top-[60px]">
            <div className="glass rounded-full px-4 py-1.5 text-xs text-amber-300">移動模式：拖拉選取的物件到新位置（Enter / Esc 結束）</div>
          </div>
        )}
        {placing && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center px-3 max-lg:top-[60px]">
            <div className="glass rounded-full px-4 py-1.5 text-xs text-sky-300">放置立足點：點地板決定位置，按住拖曳可指定視線方向（Esc 取消）</div>
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
