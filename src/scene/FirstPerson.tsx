import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MEP_ITEMS, VANTAGE } from '../data'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import type { EyeMode, Vec2, VantageHotspot } from '../types'

const D = Math.PI / 180
const EYE_HEIGHT: Record<EyeMode, number> = { stand: 1.65, sit: 1.1, robot: 0.3 }

/** 第一人稱相機的即時狀態（高頻更新，不進 React / zustand） */
export const fpLive = { x: 0, z: 0, yaw: 0, pitch: 0, eye: 1.65, ready: false }
if (import.meta.env.DEV) (window as unknown as { __fpLive: unknown }).__fpLive = fpLive

/** 視線朝向（弧度）：yaw = 0 看向北（−Z），正值 = 俯視逆時針（轉向西） */
export const yawToward = (from: Vec2, to: Vec2) => Math.atan2(-(to[0] - from[0]), -(to[1] - from[1]))

export const eyeHeight = (mode: EyeMode, standCm: number) => (mode === 'stand' ? standCm / 100 : EYE_HEIGHT[mode])

/** 目前格局是否就是鴻築麗苑（vantage.json 的天花板外框與預設點才有意義） */
function useVantage() {
  const floor = useLayout((s) => s.layout.floor)
  return useMemo(() => {
    const f = VANTAGE.floor
    const same =
      Math.abs(f.center[0] - floor.center[0]) < 0.01 &&
      Math.abs(f.center[1] - floor.center[1]) < 0.01 &&
      Math.abs(f.size[0] - floor.size[0]) < 0.01 &&
      Math.abs(f.size[1] - floor.size[1]) < 0.01
    const hx = floor.size[0] / 2
    const hz = floor.size[1] / 2
    const rect: Vec2[] = [
      [floor.center[0] - hx, floor.center[1] - hz],
      [floor.center[0] + hx, floor.center[1] - hz],
      [floor.center[0] + hx, floor.center[1] + hz],
      [floor.center[0] - hx, floor.center[1] + hz],
    ]
    return {
      ceiling: same ? VANTAGE.ceiling : rect,
      height: same ? VANTAGE.ceilingHeight : 2.6,
      hotspots: same ? VANTAGE.hotspots : [],
      extra: same ? VANTAGE.extraWalk ?? [] : [],
    }
  }, [floor])
}

export function useHotspots(): VantageHotspot[] {
  return useVantage().hotspots
}

function inPolygon(x: number, z: number, poly: Vec2[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

/** 可站立的區域：天花板外框 + 額外可走區（陽台） */
function useWalkable() {
  const v = useVantage()
  return useMemo(
    () => (x: number, z: number) =>
      inPolygon(x, z, v.ceiling) ||
      v.extra.some((r) => Math.abs(x - r.center[0]) <= r.size[0] / 2 && Math.abs(z - r.center[1]) <= r.size[1] / 2),
    [v],
  )
}

/** 從第一人稱 / 工具列進入：沒去過就從第一個預設點（玄關進門）開始，去過就回到上次的位置 */
export function enterFirstPerson() {
  const ui = useUi.getState()
  if (fpLive.ready) return ui.setViewMode('firstPerson')
  const h = VANTAGE.hotspots[0]
  const fc = useLayout.getState().layout.floor.center
  const matches = Math.abs(VANTAGE.floor.center[0] - fc[0]) < 0.01
  if (matches && h) ui.goVantage(h.pos[0], h.pos[1], yawToward(h.pos, h.look), h.eye)
  else ui.goVantage(fc[0], fc[1], 0)
}

export function goHotspot(h: VantageHotspot) {
  useUi.getState().goVantage(h.pos[0], h.pos[1], yawToward(h.pos, h.look), h.eye)
}

function isVisible(o: THREE.Object3D | null) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false
  return true
}

/** 滑鼠 / 手指射線 → 地面（y = 0）交點；blocked = 地面點前方有牆或家具擋住 */
function pickFloor(ray: THREE.Raycaster, scene: THREE.Scene) {
  const { origin, direction } = ray.ray
  if (direction.y >= -1e-4) return null
  const t = -origin.y / direction.y
  const pt = origin.clone().addScaledVector(direction, t)
  let blocked = false
  for (const h of ray.intersectObjects(scene.children, true)) {
    const o = h.object as THREE.Mesh
    if (!o.isMesh || o.userData.noPick || !isVisible(o)) continue
    const m = o.material as THREE.Material | THREE.Material[]
    if (!Array.isArray(m) && (m.visible === false || (m.transparent && m.opacity < 0.05))) continue
    if (h.distance < t - 0.15) {
      blocked = true
      break
    }
  }
  return { pt, blocked }
}

function ndcOf(e: { clientX: number; clientY: number }, el: HTMLElement) {
  const r = el.getBoundingClientRect()
  return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
}

/** 站立點圓環 + 視線方向箭頭（朝 −Z，由外層 group 的 rotation-y 決定方向） */
function Pin({ color, groupRef }: { color: string; groupRef: React.RefObject<THREE.Group | null> }) {
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95, toneMapped: false, side: THREE.DoubleSide }),
    [color],
  )
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <group ref={groupRef} visible={false} position={[0, 0.03, 0]} renderOrder={1000} userData={{ noPick: true }}>
      <mesh rotation-x={-Math.PI / 2} material={mat} renderOrder={1000} userData={{ noPick: true }}>
        <ringGeometry args={[0.24, 0.32, 40]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} material={mat} renderOrder={1000} userData={{ noPick: true }}>
        <circleGeometry args={[0.09, 20]} />
      </mesh>
      <mesh position={[0, 0, -0.62]} rotation-x={-Math.PI / 2} material={mat} renderOrder={1000} userData={{ noPick: true }}>
        <coneGeometry args={[0.16, 0.32, 3]} />
      </mesh>
      <mesh position={[0, 0, -0.42]} rotation-x={-Math.PI / 2} material={mat} renderOrder={1000} userData={{ noPick: true }}>
        <planeGeometry args={[0.06, 0.2]} />
      </mesh>
    </group>
  )
}

/** 方式 A：俯視角「📍 放置立足點」。移動預覽、按下決定位置、拖曳決定視線方向、放開即以第一人稱站上去。 */
export function PlacementLayer() {
  const placing = useUi((s) => s.placing)
  const viewMode = useUi((s) => s.viewMode)
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)
  const walkable = useWalkable()
  const hover = useRef<THREE.Group>(null)
  const here = useRef<THREE.Group>(null)

  // 目前站的位置（回到俯視後仍顯示）
  useFrame(() => {
    const g = here.current
    if (!g) return
    const show = fpLive.ready && viewMode === 'isometric' && !useUi.getState().placing
    g.visible = show
    if (show) {
      g.position.set(fpLive.x, 0.03, fpLive.z)
      g.rotation.y = fpLive.yaw
    }
  })

  useEffect(() => {
    if (!placing || viewMode !== 'isometric') return
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const fc = useLayout.getState().layout.floor.center
    let anchor: THREE.Vector3 | null = null
    let yaw = 0
    const hit = (e: PointerEvent) => {
      const s = get()
      ray.setFromCamera(ndcOf(e, el), s.camera)
      const r = pickFloor(ray, s.scene)
      return r && !r.blocked && walkable(r.pt.x, r.pt.z) ? r.pt : null
    }
    const show = (pt: THREE.Vector3 | null) => {
      const g = hover.current
      if (!g) return
      g.visible = !!pt
      if (pt) {
        g.position.set(pt.x, 0.03, pt.z)
        g.rotation.y = yaw
      }
    }
    const onMove = (e: PointerEvent) => {
      if (anchor) {
        const s = get()
        ray.setFromCamera(ndcOf(e, el), s.camera)
        const { origin, direction } = ray.ray
        if (direction.y < -1e-4) {
          const t = -origin.y / direction.y
          const x = origin.x + direction.x * t
          const z = origin.z + direction.z * t
          if (Math.hypot(x - anchor.x, z - anchor.z) > 0.2) yaw = yawToward([anchor.x, anchor.z], [x, z])
        }
        show(anchor)
      } else {
        const pt = hit(e)
        if (pt) yaw = yawToward([pt.x, pt.z], fc as Vec2)
        show(pt)
      }
    }
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      const pt = hit(e)
      if (!pt) return useUi.getState().showToast('這裡不是可站立的地面（被牆或家具擋住）')
      anchor = pt.clone()
      yaw = yawToward([pt.x, pt.z], fc as Vec2)
      el.setPointerCapture?.(e.pointerId)
      show(anchor)
    }
    const onUp = () => {
      if (!anchor) return
      const a = anchor
      anchor = null
      useUi.getState().goVantage(a.x, a.z, yaw)
    }
    const onCancel = () => {
      anchor = null
      show(null)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onCancel)
    const prevCursor = el.style.cursor
    el.style.cursor = 'crosshair'
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onCancel)
      el.style.cursor = prevCursor
      if (hover.current) hover.current.visible = false
    }
  }, [placing, viewMode, gl, get, walkable])

  return (
    <>
      <Pin color="#38bdf8" groupRef={hover} />
      <Pin color="#f59e0b" groupRef={here} />
    </>
  )
}

/** 第一人稱相機：原地轉頭、點地板走過去、預設點 / 人眼高度切換 */
export function FirstPersonRig() {
  const set = useThree((s) => s.set)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  const walkable = useWalkable()
  const ring = useRef<THREE.Mesh>(null)
  const cam = useMemo(() => {
    const c = new THREE.PerspectiveCamera(70, 1, 0.05, 200)
    c.rotation.order = 'YXZ'
    return c
  }, [])
  const consumed = useRef(-1)
  const target = useRef({ x: 0, z: 0, yaw: null as number | null })
  const sizeRef = useRef(size)
  sizeRef.current = size

  useLayoutEffect(() => {
    set({ camera: cam })
    const g = useUi.getState().fpGoto
    if (!fpLive.ready || g.nonce !== lastConsumed) {
      fpLive.x = g.x
      fpLive.z = g.z
      if (g.yaw !== null) fpLive.yaw = g.yaw
      fpLive.pitch = 0
      fpLive.eye = eyeHeight(useUi.getState().eye, useUi.getState().standCm)
      fpLive.ready = true
    }
    consumed.current = g.nonce
    lastConsumed = g.nonce
    target.current = { x: fpLive.x, z: fpLive.z, yaw: null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    let down: { x: number; y: number; moved: boolean; id: number } | null = null
    let lastHover = 0

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      down = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }
      el.setPointerCapture?.(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (down) {
        const dx = e.clientX - down.x
        const dy = e.clientY - down.y
        if (!down.moved && Math.hypot(dx, dy) > 5) down.moved = true
        if (down.moved) {
          // 抓住畫面拖：整個畫面高度 = 一個垂直視角
          const k = (cam.fov * D) / Math.max(sizeRef.current.height, 1)
          fpLive.yaw += dx * k
          fpLive.pitch = THREE.MathUtils.clamp(fpLive.pitch + dy * k, -80 * D, 80 * D)
          target.current.yaw = null
          down.x = e.clientX
          down.y = e.clientY
        }
        return
      }
      if (e.pointerType !== 'mouse') return
      const now = performance.now()
      if (now - lastHover < 50) return
      lastHover = now
      ray.setFromCamera(ndcOf(e, el), cam)
      const r = pickFloor(ray, scene)
      const m = ring.current
      if (!m) return
      const ok = !!r && !r.blocked && walkable(r.pt.x, r.pt.z)
      m.visible = ok
      if (ok) m.position.set(r.pt.x, 0.03, r.pt.z)
    }
    const onUp = (e: PointerEvent) => {
      const d = down
      down = null
      if (!d || d.moved) return
      // 方式 B：點擊前方地板 → 平滑走過去
      ray.setFromCamera(ndcOf(e, el), cam)
      const r = pickFloor(ray, scene)
      if (!r) return
      if (r.blocked || !walkable(r.pt.x, r.pt.z)) return useUi.getState().showToast('這裡走不到（被牆或家具擋住）')
      useUi.getState().goVantage(r.pt.x, r.pt.z, null)
    }
    const onLeave = () => {
      if (ring.current) ring.current.visible = false
    }
    const onKey = (e: KeyboardEvent) => {
      const el2 = e.target as HTMLElement | null
      if (el2 && (el2.tagName === 'INPUT' || el2.tagName === 'TEXTAREA' || el2.tagName === 'SELECT')) return
      const step = 6 * D
      if (e.key === 'ArrowLeft') fpLive.yaw += step
      else if (e.key === 'ArrowRight') fpLive.yaw -= step
      else if (e.key === 'ArrowUp') fpLive.pitch = Math.min(80 * D, fpLive.pitch + step)
      else if (e.key === 'ArrowDown') fpLive.pitch = Math.max(-80 * D, fpLive.pitch - step)
      else return
      target.current.yaw = null
      e.preventDefault()
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', () => (down = null))
    el.addEventListener('pointerleave', onLeave)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('keydown', onKey)
    }
  }, [gl, scene, cam, walkable])

  useFrame((_, dt) => {
    const ui = useUi.getState()
    if (ui.fpGoto.nonce !== consumed.current) {
      consumed.current = ui.fpGoto.nonce
      lastConsumed = ui.fpGoto.nonce
      target.current = { x: ui.fpGoto.x, z: ui.fpGoto.z, yaw: ui.fpGoto.yaw }
    }
    const t = target.current
    // 位置：Lerp 走過去（接近時才收斂，避免長距離一下就到）
    const dist = Math.hypot(t.x - fpLive.x, t.z - fpLive.z)
    const lam = dist > 0.01 ? 3.2 : 20
    fpLive.x = THREE.MathUtils.damp(fpLive.x, t.x, lam, dt)
    fpLive.z = THREE.MathUtils.damp(fpLive.z, t.z, lam, dt)
    if (t.yaw !== null) {
      const to = fpLive.yaw + Math.atan2(Math.sin(t.yaw - fpLive.yaw), Math.cos(t.yaw - fpLive.yaw))
      fpLive.yaw = THREE.MathUtils.damp(fpLive.yaw, to, 4, dt)
      fpLive.pitch = THREE.MathUtils.damp(fpLive.pitch, 0, 4, dt)
      if (Math.abs(to - fpLive.yaw) < 0.001) t.yaw = null
    }
    fpLive.eye = THREE.MathUtils.damp(fpLive.eye, eyeHeight(ui.eye, ui.standCm), 8, dt)

    cam.position.set(fpLive.x, fpLive.eye, fpLive.z)
    cam.rotation.set(fpLive.pitch, fpLive.yaw, 0)
    const w = sizeRef.current
    if (cam.fov !== ui.fov || Math.abs(cam.aspect - w.width / w.height) > 1e-4) {
      cam.fov = ui.fov
      cam.aspect = w.width / w.height
      cam.updateProjectionMatrix()
    }
  })

  return (
    <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false} renderOrder={1000} userData={{ noPick: true }}>
      <ringGeometry args={[0.16, 0.22, 36]} />
      <meshBasicMaterial color="#ffffff" depthTest={false} transparent opacity={0.85} toneMapped={false} />
    </mesh>
  )
}

let lastConsumed = -1

/** 第一人稱時蓋上的天花板（俯視模式不渲染，所以不影響破牆視角） */
export function Ceiling() {
  const v = useVantage()
  const geo = useMemo(
    () => new THREE.ShapeGeometry(new THREE.Shape(v.ceiling.map(([x, z]) => new THREE.Vector2(x, z)))),
    [v.ceiling],
  )
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <>
      <mesh geometry={geo} rotation-x={Math.PI / 2} position={[0, v.height, 0]} userData={{ noPick: true }} receiveShadow>
        <meshStandardMaterial color="#f6f4ee" emissive="#efebe3" emissiveIntensity={0.5} roughness={0.92} metalness={0} />
      </mesh>
      <CeilingFixtures height={v.height} />
    </>
  )
}

const LAMP = { color: '#fff4dc', emissive: '#ffe6b0' }

/** 軌道燈、吊扇燈、吸頂燈、嵌燈、燈條：依 mep.json 的位置，真實掛在天花板上 */
function CeilingFixtures({ height }: { height: number }) {
  const lamp = useMemo(
    () => new THREE.MeshStandardMaterial({ color: LAMP.color, emissive: LAMP.emissive, emissiveIntensity: 1.4, roughness: 0.4 }),
    [],
  )
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b2b2e', roughness: 0.5, metalness: 0.6 }), [])
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b4f3a', roughness: 0.7 }), [])
  const white = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2f2f0', roughness: 0.6 }), [])
  useEffect(
    () => () => {
      lamp.dispose()
      metal.dispose()
      wood.dispose()
      white.dispose()
    },
    [lamp, metal, wood, white],
  )
  return (
    <group userData={{ noPick: true }}>
      {MEP_ITEMS.filter((it) => !it.face).map((it) => {
        const [x, z] = it.at
        const d = it.diameter ?? 0.15
        const len = it.length ?? 1
        if (it.kind === 'downlight')
          return (
            <group key={it.id} position={[x, height, z]}>
              <mesh position={[0, -0.008, 0]} material={white}>
                <cylinderGeometry args={[0.075, 0.075, 0.016, 28]} />
              </mesh>
              <mesh position={[0, -0.018, 0]} material={lamp}>
                <cylinderGeometry args={[0.055, 0.055, 0.006, 28]} />
              </mesh>
            </group>
          )
        if (it.kind === 'ceiling')
          return (
            <group key={it.id} position={[x, height, z]}>
              <mesh position={[0, -0.03, 0]} material={white}>
                <cylinderGeometry args={[d / 2, d / 2, 0.06, 40]} />
              </mesh>
              <mesh position={[0, -0.062, 0]} material={lamp}>
                <cylinderGeometry args={[d / 2 - 0.02, d / 2 - 0.02, 0.006, 40]} />
              </mesh>
            </group>
          )
        if (it.kind === 'fan') {
          const rod = 0.25
          const blade = Math.max(0.5, d * 1.2)
          return (
            <group key={it.id} position={[x, height, z]}>
              <mesh position={[0, -rod / 2, 0]} material={metal}>
                <cylinderGeometry args={[0.012, 0.012, rod, 10]} />
              </mesh>
              <mesh position={[0, -rod - 0.04, 0]} material={metal}>
                <cylinderGeometry args={[0.09, 0.11, 0.1, 24]} />
              </mesh>
              {[0, 1, 2, 3, 4].map((i) => (
                <group key={i} rotation-y={(i * 2 * Math.PI) / 5} position={[0, -rod - 0.06, 0]}>
                  <mesh position={[0.08 + blade / 2, 0, 0]} material={wood}>
                    <boxGeometry args={[blade, 0.012, 0.12]} />
                  </mesh>
                </group>
              ))}
              <mesh position={[0, -rod - 0.1, 0]} material={lamp}>
                <cylinderGeometry args={[0.1, 0.1, 0.012, 24]} />
              </mesh>
            </group>
          )
        }
        if (it.kind === 'track') {
          const along: [number, number, number] = it.dir === 'z' ? [0, 0, 1] : [1, 0, 0]
          const drop = height - it.h
          const heads = it.heads ?? 0
          return (
            <group key={it.id} position={[x, it.h, z]}>
              <mesh material={metal}>
                <boxGeometry args={it.dir === 'z' ? [0.035, 0.03, len] : [len, 0.03, 0.035]} />
              </mesh>
              {drop > 0.02 &&
                [-1, 1].map((s) => (
                  <mesh key={s} position={[along[0] * s * (len / 2 - 0.1), drop / 2, along[2] * s * (len / 2 - 0.1)]} material={metal}>
                    <cylinderGeometry args={[0.006, 0.006, drop, 8]} />
                  </mesh>
                ))}
              {Array.from({ length: heads }, (_, i) => {
                const p = heads === 1 ? 0 : (i / (heads - 1) - 0.5) * (len - 0.3)
                return (
                  <group key={i} position={[along[0] * p, -0.03, along[2] * p]} rotation={[0.45, 0, 0]}>
                    <mesh position={[0, -0.07, 0]} material={metal}>
                      <cylinderGeometry args={[0.035, 0.05, 0.14, 16]} />
                    </mesh>
                    <mesh position={[0, -0.142, 0]} material={lamp}>
                      <cylinderGeometry args={[0.04, 0.04, 0.006, 16]} />
                    </mesh>
                  </group>
                )
              })}
            </group>
          )
        }
        // strip：燈條
        return (
          <mesh key={it.id} position={[x, it.h, z]} material={lamp}>
            <boxGeometry args={it.dir === 'z' ? [0.03, 0.02, len] : [len, 0.02, 0.03]} />
          </mesh>
        )
      })}
    </group>
  )
}
