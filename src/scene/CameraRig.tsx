import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import type { ViewPreset } from '../types'

const D = Math.PI / 180
const ISO_POLAR = 55 * D // 接近世紀帝國的 2:1 等距俯角
const FOV = 35
const ORTHO_DIST = 60

/** 世紀帝國標準方位：相機位於房間的哪個角落（+X = 東，+Z = 南） */
export const VIEW_PRESETS: Record<ViewPreset, { azimuth: number; polar: number; label: string }> = {
  SE: { azimuth: 45 * D, polar: ISO_POLAR, label: '東南' },
  SW: { azimuth: -45 * D, polar: ISO_POLAR, label: '西南' },
  NW: { azimuth: -135 * D, polar: ISO_POLAR, label: '西北' },
  NE: { azimuth: 135 * D, polar: ISO_POLAR, label: '東北' },
  TOP: { azimuth: 0, polar: 0.0005, label: '平面' },
}

/** 兩種投影共用的「視野高度（公尺）」→ 切換鏡頭時視覺大小一致 */
interface ViewState {
  target: THREE.Vector3
  azimuth: number
  polar: number
  viewSize: number
}

/** 目前畫面中心對準的地面點（供「新增家具到畫面中央」使用） */
export const viewTarget = new THREE.Vector3()

function shortest(from: number, to: number) {
  return from + Math.atan2(Math.sin(to - from), Math.cos(to - from))
}

export function CameraRig() {
  const set = useThree((s) => s.set)
  const size = useThree((s) => s.size)
  const projection = useLayout((s) => s.settings.projection)
  const floorCenter = useLayout((s) => s.layout.floor.center)
  const viewRequest = useUi((s) => s.viewRequest)
  const viewMode = useUi((s) => s.viewMode)
  const fp = viewMode === 'firstPerson'
  const controlsRef = useRef<OrbitControlsImpl>(null)

  const ortho = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400), [])
  const persp = useMemo(() => new THREE.PerspectiveCamera(FOV, 1, 0.1, 400), [])

  // 初始視野：至少 9 m 高，並確保窄螢幕（手機直式）也能左右完整看到整個房間
  const view = useRef<ViewState>(null as unknown as ViewState)
  if (!view.current) {
    const fs = useLayout.getState().layout.floor.size
    const need = (fs[0] + fs[1]) * 0.72 + 1.6
    view.current = {
      target: new THREE.Vector3(floorCenter[0], 0, floorCenter[1]),
      azimuth: VIEW_PRESETS.SE.azimuth,
      polar: ISO_POLAR,
      viewSize: Math.max(9, (fs[0] + fs[1]) * 0.62 + 3.5, need / Math.max(size.width / Math.max(size.height, 1), 0.2)),
    }
  }
  const anim = useRef<{ preset: ViewPreset; azimuth: number; polar: number } | null>(null)
  const lastSize = useRef({ w: 0, h: 0, p: '' })

  /** 依 view 狀態擺放指定相機 */
  const place = (cam: THREE.Camera) => {
    const v = view.current
    const isOrtho = cam === ortho
    const dist = isOrtho ? ORTHO_DIST : v.viewSize / (2 * Math.tan((FOV * D) / 2))
    const sp = Math.sin(v.polar)
    cam.position.set(
      v.target.x + dist * sp * Math.sin(v.azimuth),
      v.target.y + dist * Math.cos(v.polar),
      v.target.z + dist * sp * Math.cos(v.azimuth),
    )
    cam.lookAt(v.target)
    if (isOrtho) {
      ortho.left = -size.width / 2
      ortho.right = size.width / 2
      ortho.top = size.height / 2
      ortho.bottom = -size.height / 2
      ortho.zoom = size.height / v.viewSize
      ortho.updateProjectionMatrix()
    } else {
      persp.aspect = size.width / size.height
      persp.updateProjectionMatrix()
    }
    cam.updateMatrixWorld()
  }

  // 切換正交/透視：沿用同一個視角與視野大小
  useLayoutEffect(() => {
    if (fp) return // 第一人稱：由 FirstPersonRig 接手相機
    const cam = projection === 'ortho' ? ortho : persp
    place(cam)
    set({ camera: cam })
    lastSize.current = { w: size.width, h: size.height, p: projection }
    const c = controlsRef.current
    if (c) {
      c.target.copy(view.current.target)
      c.update()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection, fp])

  // 工具列 / 空白鍵請求的預設視角
  useEffect(() => {
    if (viewRequest.nonce === 0) return
    const p = VIEW_PRESETS[viewRequest.preset]
    anim.current = {
      preset: viewRequest.preset,
      azimuth: shortest(view.current.azimuth, p.azimuth),
      polar: p.polar,
    }
  }, [viewRequest])

  useFrame((state, dt) => {
    if (useUi.getState().viewMode === 'firstPerson') return
    const cam = state.camera
    const c = controlsRef.current
    const v = view.current

    // 視窗大小改變 → 更新投影參數但保持視野大小
    const ls = lastSize.current
    if (ls.w !== size.width || ls.h !== size.height || ls.p !== projection) {
      ls.w = size.width
      ls.h = size.height
      ls.p = projection
      if (cam === ortho) {
        ortho.left = -size.width / 2
        ortho.right = size.width / 2
        ortho.top = size.height / 2
        ortho.bottom = -size.height / 2
        ortho.zoom = size.height / v.viewSize
        ortho.updateProjectionMatrix()
      } else {
        persp.aspect = size.width / size.height
        persp.updateProjectionMatrix()
      }
    }

    // 視角平滑轉場
    const a = anim.current
    if (a && c) {
      v.azimuth = THREE.MathUtils.damp(v.azimuth, a.azimuth, 7, dt)
      v.polar = THREE.MathUtils.damp(v.polar, a.polar, 7, dt)
      const done = Math.abs(v.azimuth - a.azimuth) < 0.002 && Math.abs(v.polar - a.polar) < 0.002
      if (done) {
        v.azimuth = a.azimuth
        v.polar = a.polar
        anim.current = null
      }
      const dist = cam.position.distanceTo(c.target)
      const sp = Math.sin(v.polar)
      cam.position.set(
        c.target.x + dist * sp * Math.sin(v.azimuth),
        c.target.y + dist * Math.cos(v.polar),
        c.target.z + dist * sp * Math.cos(v.azimuth),
      )
      cam.lookAt(c.target)
      c.update()
    }

    // 回寫使用者操作後的視角狀態（供切換投影/預設視角使用）
    if (c) {
      if (c.target.y !== 0) c.target.y = 0
      v.target.copy(c.target)
      viewTarget.copy(c.target)
      const off = cam.position.clone().sub(c.target)
      const r = off.length()
      if (r > 1e-6) {
        v.polar = Math.acos(THREE.MathUtils.clamp(off.y / r, -1, 1))
        if (Math.hypot(off.x, off.z) > 1e-6 && !a) v.azimuth = Math.atan2(off.x, off.z)
      }
      v.viewSize =
        cam === ortho ? size.height / Math.max(ortho.zoom, 1e-6) : 2 * r * Math.tan((FOV * D) / 2)
    }
  })

  const isOrtho = projection === 'ortho'
  return (
    <OrbitControls
      key={projection}
      ref={controlsRef}
      makeDefault
      enabled={!fp}
      camera={isOrtho ? ortho : persp}
      enableDamping
      dampingFactor={0.1}
      // 左鍵旋轉、右鍵平移、滾輪縮放；手機單指旋轉、雙指縮放+平移（預設 touches 即如此）
      screenSpacePanning={false}
      minPolarAngle={0}
      maxPolarAngle={Math.PI / 2.1}
      minZoom={14}
      maxZoom={520}
      minDistance={1.2}
      maxDistance={45}
      zoomSpeed={0.9}
      onStart={() => {
        anim.current = null
      }}
    />
  )
}
