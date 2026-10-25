import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'

/**
 * 按需渲染：場景是靜態的，只有「使用者操作 / 資料變動 / 資源載入」後的短時間才連續出幀，
 * 閒置時 GPU 完全不工作（手機不發熱、筆電不吃電），畫質與連續渲染完全相同。
 * 陰影圖也只在家具/牆/燈具變動時重算（見 FrameLoop）。
 */
const ACTIVE_MS = 2500

let wakeImpl: (ms: number) => void = () => {}
let dirtyImpl: () => void = () => {}

/** 讓畫面連續渲染 ms 毫秒（動畫、轉場、貼圖載入後的淡入都靠這個） */
export const wake = (ms = ACTIVE_MS) => wakeImpl(ms)
/** 下一幀重算陰影圖 */
export const dirtyShadows = () => dirtyImpl()

export function FrameLoop() {
  const gl = useThree((s) => s.gl)
  const setFrameloop = useThree((s) => s.setFrameloop)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    gl.shadowMap.autoUpdate = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let until = 0
    let burst = 0

    const dirty = () => {
      gl.shadowMap.needsUpdate = true
      invalidate()
    }
    const wakeFn = (ms: number) => {
      until = Math.max(until, performance.now() + ms)
      setFrameloop('always')
      clearTimeout(timer)
      const tick = () => {
        const left = until - performance.now()
        if (left > 0) {
          timer = setTimeout(tick, left)
        } else {
          setFrameloop('demand')
          invalidate()
        }
      }
      timer = setTimeout(tick, ms)
    }
    wakeImpl = wakeFn
    dirtyImpl = dirty

    // 啟動後 8 秒內持續出幀並重算陰影：貼圖、HDRI、GLB 陸續載入完成
    wakeFn(8000)
    const warm = setInterval(() => {
      gl.shadowMap.needsUpdate = true
      if (++burst >= 8) clearInterval(warm)
    }, 1000)

    const el = gl.domElement
    const onInput = () => wakeFn(ACTIVE_MS)
    const events = ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'touchstart', 'touchmove', 'keydown', 'keyup'] as const
    for (const ev of events) window.addEventListener(ev, onInput, { passive: true })
    window.addEventListener('resize', onInput)

    const manager = THREE.DefaultLoadingManager
    const prevLoad = manager.onLoad
    const prevProgress = manager.onProgress
    manager.onProgress = (...a) => {
      prevProgress?.(...a)
      wakeFn(1500)
      dirty()
    }
    manager.onLoad = () => {
      prevLoad?.()
      wakeFn(1500)
      dirty()
    }

    // 資料/狀態變動 → 重算陰影並喚醒
    const unsubLayout = useLayout.subscribe((s, p) => {
      if (s.layout !== p.layout) dirty()
      wakeFn(ACTIVE_MS)
    })
    const unsubUi = useUi.subscribe((s, p) => {
      if (s.viewMode !== p.viewMode) dirty()
      wakeFn(ACTIVE_MS)
    })

    return () => {
      clearTimeout(timer)
      clearInterval(warm)
      for (const ev of events) window.removeEventListener(ev, onInput)
      window.removeEventListener('resize', onInput)
      manager.onProgress = prevProgress
      manager.onLoad = prevLoad
      unsubLayout()
      unsubUi()
      void el
    }
  }, [gl, setFrameloop, invalidate])

  // 拖拉 / 位移軸操作中：家具影子要跟著手走，逐幀重算
  useFrame(() => {
    if (useUi.getState().dragging) gl.shadowMap.needsUpdate = true
  }, -1)

  return null
}
