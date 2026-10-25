import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { WebGLPathTracer } from 'three-gpu-pathtracer'
import { useUi } from '../store/uiStore'

/** 路徑追蹤時要隱藏的輔助物件：線條、點、貼紙、操作 gizmo、標記 */
function isHelper(o: THREE.Object3D) {
  const x = o as THREE.Object3D & { isLine?: boolean; isPoints?: boolean; isSprite?: boolean; isTransformControls?: boolean }
  return !!(x.isLine || x.isPoints || x.isSprite || x.isTransformControls || x.userData.noPT)
}

/**
 * 高品質渲染：把目前視角用 GPU 路徑追蹤漸進式渲染到畫布上（真實全域光照、柔和陰影、
 * 燈具實際光源、材質反射）。掛上期間 PostFX 卸載、相機凍結；卸載時還原一切。
 */
export function PathTraceRender() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const ref = useRef<WebGLPathTracer | null>(null)
  const hidden = useRef<THREE.Object3D[]>([])
  const lastPush = useRef(0)
  const saved = useRef(useUi.getState().pt.saveNonce)

  useEffect(() => {
    const ui = useUi.getState()
    const prevTone = { m: gl.toneMapping, e: gl.toneMappingExposure }
    const prevBg = scene.background
    let cancelled = false
    ui.setPt({ status: 'building', samples: 0 })
    // 等一個 frame 讓 PostFX 卸載與 R3F 畫面穩定，再抓場景
    const t = setTimeout(() => {
      if (cancelled) return
      try {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1
        scene.traverse((o) => {
          if (o.visible && isHelper(o)) {
            o.visible = false
            hidden.current.push(o)
          }
        })
        const pt = new WebGLPathTracer(gl)
        pt.renderScale = useUi.getState().pt.scale
        pt.bounces = 5
        pt.transmissiveBounces = 3
        pt.filterGlossyFactor = 0.5
        pt.tiles.set(2, 2)
        pt.minSamples = 1
        pt.renderDelay = 0
        pt.fadeDuration = 0
        pt.rasterizeScene = false
        pt.setScene(scene, camera)
        ref.current = pt
        useUi.getState().setPt({ status: 'rendering' })
      } catch (e) {
        console.error('path tracer failed', e)
        useUi.getState().setPt({ status: 'error' })
      }
    }, 60)
    return () => {
      cancelled = true
      clearTimeout(t)
      ref.current?.dispose()
      ref.current = null
      hidden.current.forEach((o) => (o.visible = true))
      hidden.current = []
      scene.background = prevBg
      gl.toneMapping = prevTone.m
      gl.toneMappingExposure = prevTone.e
      useUi.getState().setPt({ status: 'idle', samples: 0 })
    }
  }, [gl, scene, camera])

  useEffect(() => {
    if (!ref.current) return
    ref.current.renderScale = useUi.getState().pt.scale
    ref.current.updateCamera()
    ref.current.reset()
  }, [size])

  // priority > 0：接管 R3F 的渲染迴圈
  useFrame(() => {
    const pt = ref.current
    if (!pt) return
    const st = useUi.getState().pt
    if (st.status === 'done') {
      pt.renderSample() // 保持畫面（pausePathTracing 時只重畫已累積結果）
    } else {
      pt.pausePathTracing = false
      pt.renderSample()
    }
    const n = Math.floor(pt.samples)
    const now = performance.now()
    if (now - lastPush.current > 250 || n >= st.target) {
      lastPush.current = now
      const done = n >= st.target
      if (done) pt.pausePathTracing = true
      if (n !== st.samples || (done && st.status !== 'done')) useUi.getState().setPt({ samples: n, status: done ? 'done' : 'rendering' })
    }
    // 下載 PNG：在同一個 task 內、畫完後立刻讀取畫布
    if (st.saveNonce !== saved.current) {
      saved.current = st.saveNonce
      gl.domElement.toBlob((b) => {
        if (!b) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(b)
        a.download = `render-${Date.now()}.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 2000)
      }, 'image/png')
    }
  }, 1000)

  return null
}
