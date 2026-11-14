import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'
import { create } from 'zustand'

/** 場景（Suspense 內的所有元件）掛載完成後由 <SceneReady /> 設為 true */
export const useBoot = create<{ sceneReady: boolean }>(() => ({ sceneReady: false }))

const MIN_SHOW_MS = 500
const IDLE_MS = 300
const MAX_WAIT_MS = 20000

/**
 * 首次載入畫面：index.html 內已有純 CSS 的啟動畫面（JS 下載期間），
 * 這裡接手並顯示「真實進度」——由 three 的 DefaultLoadingManager（貼圖 / HDR / GLB）回報 loaded / total。
 * 條件：場景已掛載且載入管理器閒置 300 ms 才淡出；20 秒保底。進度只增不減（總數會隨排隊增加）。
 */
export function LoadingScreen() {
  const { progress, active } = useProgress()
  const sceneReady = useBoot((s) => s.sceneReady)
  const [done, setDone] = useState(false)
  const [gone, setGone] = useState(false)
  const [shown, setShown] = useState(0)
  const [t0] = useState(() => performance.now())

  // 接手 index.html 的啟動畫面
  useEffect(() => {
    document.getElementById('boot')?.remove()
  }, [])

  useEffect(() => {
    setShown((p) => Math.max(p, sceneReady ? Math.max(progress, 90) : Math.min(progress, 90)))
  }, [progress, sceneReady])

  useEffect(() => {
    if (done || !sceneReady || active) return
    const wait = Math.max(IDLE_MS, MIN_SHOW_MS - (performance.now() - t0))
    const id = setTimeout(() => {
      setShown(100)
      setDone(true)
    }, wait)
    return () => clearTimeout(id)
  }, [sceneReady, active, done, t0])

  useEffect(() => {
    const id = setTimeout(() => setDone(true), MAX_WAIT_MS)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!done) return
    const id = setTimeout(() => setGone(true), 500)
    return () => clearTimeout(id)
  }, [done])

  if (gone) return null
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-slate-900 text-slate-200 transition-opacity duration-500"
      style={{ opacity: done ? 0 : 1, pointerEvents: done ? 'none' : 'auto' }}
      role="status"
      aria-live="polite"
    >
      <div className="text-sm font-semibold tracking-wide">3D 室內裝潢規劃</div>
      <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
        <div className="h-full origin-left rounded-full bg-sky-400 transition-transform duration-300 ease-out" style={{ transform: `scaleX(${shown / 100})` }} />
      </div>
      <div className="text-xs tabular-nums text-slate-400">載入材質與模型 {Math.round(shown)}%</div>
    </div>
  )
}

/** 放在 <Suspense> 內：子元件全部就緒才會掛載 */
export function SceneReady() {
  useEffect(() => {
    useBoot.setState({ sceneReady: true })
  }, [])
  return null
}
