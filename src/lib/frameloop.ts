import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { create } from 'zustand'
import { LEAN } from './lean'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'

/**
 * 動靜分離雙態渲染（Interaction-Aware Progressive Rendering）
 *
 * - 互動中（拖曳 / 縮放 / 按鍵 / 動畫 / 載入）：連續出幀；後製管線的結構與解析度（dpr、渲染目標、shader）互動前後完全相同。
 *   （iOS 上在手勢開始的瞬間重配 dpr / AO 模式 / 增減效果 pass 會讓 WebGL context 被系統收掉，所以只切換「是否持續出幀」。）
 * - 停下 180 ms 後：補幾幀定格，之後 GPU 閒置（frameloop = demand）。
 * - 陰影圖 autoUpdate = false，只在資料變動 / 切換視角 / 資源載入後重算。
 *
 * 狀態切換全部由 DOM 事件與計時器觸發，不在 useFrame 內呼叫任何 setState / zustand set。
 */
export const SETTLE_MS = 180
const ANIM_MS = 1200

interface FxState {
  /** true = 靜止定格（相片級）；false = 互動中 */
  hq: boolean
  /** 互動中的自動降級等級：0 正常、1 觀察期、2 互動中暫時關閉 AO（只影響互動中，靜止畫質不變） */
  level: 0 | 1 | 2
}
export const useFx = create<FxState>(() => ({ hq: true, level: 0 }))

let wakeImpl: (ms: number) => void = () => {}
let dirtyImpl: () => void = () => {}

/** 讓畫面進入互動（連續出幀、低成本）狀態 ms 毫秒（動畫、轉場、載入都靠這個） */
export const wake = (ms = ANIM_MS) => wakeImpl(ms)
/** 下一幀重算陰影圖 */
export const dirtyShadows = () => dirtyImpl()

export function FrameLoop() {
  const gl = useThree((s) => s.gl)
  const setFrameloop = useThree((s) => s.setFrameloop)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    let until = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let raf = 0
    let active = false

    const dirty = () => {
      gl.shadowMap.needsUpdate = true
      invalidate()
    }

    // 互動中的 FPS 監看（取代常駐 PerformanceMonitor：按需出幀下閒置間隔會被誤判成低 FPS，這裡只量互動中的幀間隔）
    let last = 0
    let sum = 0
    let n = 0
    let good = 0
    const watch = (t: number) => {
      if (!active) return
      raf = requestAnimationFrame(watch)
      if (last) {
        const dt = t - last
        if (dt < 250) {
          sum += dt
          n++
        }
        if (n >= 60) {
          const avg = sum / n
          const lvl = useFx.getState().level
          if (avg > 26 && lvl < 2) {
            useFx.setState({ level: (lvl + 1) as 0 | 1 | 2 })
            good = 0
          } else if (avg < 18 && lvl > 0) {
            if (++good >= 3) {
              useFx.setState({ level: (lvl - 1) as 0 | 1 | 2 })
                good = 0
            }
          }
          sum = 0
          n = 0
        }
      }
      last = t
    }

    const begin = () => {
      if (active) return
      active = true
      useFx.setState({ hq: false })
      setFrameloop('always')
      last = sum = n = 0
      if (!LEAN) raf = requestAnimationFrame(watch)
    }
    const settle = () => {
      active = false
      cancelAnimationFrame(raf)
      useFx.setState({ hq: true })
      setFrameloop('demand')
      // 定格：補幾幀，確保最終畫面是完整品質
      invalidate()
      setTimeout(invalidate, 60)
      setTimeout(invalidate, 250)
    }
    const arm = () => {
      clearTimeout(timer)
      const left = until - performance.now()
      timer = setTimeout(() => (until - performance.now() > 1 ? arm() : settle()), Math.max(left, 0))
    }
    const wakeFn = (ms: number) => {
      until = Math.max(until, performance.now() + ms)
      if (!active) begin()
      arm()
    }
    wakeImpl = wakeFn
    dirtyImpl = dirty

    // 啟動後先以互動態載入，貼圖 / HDRI / GLB 到齊後定格
    wakeFn(6000)
    let burst = 0
    const warm = setInterval(() => {
      gl.shadowMap.needsUpdate = true
      invalidate() // 旗標要被一次渲染消耗掉，否則會留給使用者的第一次觸碰多畫一次陰影
      if (++burst >= 7) clearInterval(warm)
    }, 1000)

    // 行動端：觸控 / 滾輪不切成連續出幀，只在事件與 OrbitControls 的 change（含慣性阻尼）時 invalidate() 補一幀 → 手指離開後 GPU 負載 0
    const onInput = () => (LEAN ? invalidate() : wakeFn(SETTLE_MS))
    const onPointer = (e: PointerEvent) => {
      // 滑鼠懸停（沒按鍵）不算互動
      if (e.type === 'pointermove' && e.pointerType === 'mouse' && e.buttons === 0) return
      if (LEAN) invalidate()
      else wakeFn(SETTLE_MS)
    }
    const passive = { passive: true } as const
    window.addEventListener('pointerdown', onPointer, passive)
    window.addEventListener('pointermove', onPointer, passive)
    window.addEventListener('pointerup', onPointer, passive)
    for (const ev of ['wheel', 'touchstart', 'touchmove', 'keydown', 'keyup', 'resize'] as const) window.addEventListener(ev, onInput, passive)

    const manager = THREE.DefaultLoadingManager
    const prevLoad = manager.onLoad
    const prevProgress = manager.onProgress
    manager.onProgress = (...a) => {
      prevProgress?.(...a)
      wakeFn(ANIM_MS)
      dirty()
    }
    manager.onLoad = () => {
      prevLoad?.()
      wakeFn(ANIM_MS)
      dirty()
    }

    // 資料 / 狀態變動 → 重算陰影（拖拉結束與位移軸放開時 layout 才會 commit，影子只在放開後重算）
    const unsubLayout = useLayout.subscribe((s, p) => {
      if (s.layout !== p.layout) dirty()
      wakeFn(ANIM_MS)
    })
    const unsubUi = useUi.subscribe((s, p) => {
      if (s.viewMode !== p.viewMode) dirty()
      wakeFn(ANIM_MS)
    })

    return () => {
      clearTimeout(timer)
      clearInterval(warm)
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('pointerup', onPointer)
      for (const ev of ['wheel', 'touchstart', 'touchmove', 'keydown', 'keyup', 'resize'] as const) window.removeEventListener(ev, onInput)
      manager.onProgress = prevProgress
      manager.onLoad = prevLoad
      unsubLayout()
      unsubUi()
    }
  }, [gl, setFrameloop, invalidate])

  return null
}
