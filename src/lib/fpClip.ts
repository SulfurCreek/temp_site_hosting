/**
 * 第一人稱「攝影師退後」：相機從立足點沿視線反方向後退，
 * 退後後貼在背後 / 穿到牆外的牆與家具要隱藏，否則會擋住視線。
 * 這裡存放相機即時狀態（由 FirstPersonRig 每幀寫入）與 2D 幾何判斷。
 */
export const fpCam = { active: false, x: 0, z: 0, px: 0, pz: 0, fx: 0, fz: -1 }

/** 相機背後多近的牆 / 櫃要隱藏（公尺） */
export const NEAR_BEHIND = 0.8
/** 已隱藏的物件要拉開到這個距離才重新顯示（避免臨界閃爍） */
export const NEAR_BEHIND_SHOW = 0.95

type P = [number, number]

function nearestOnSeg(px: number, pz: number, a: P, b: P): P {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const l2 = dx * dx + dz * dz
  const t = l2 > 1e-9 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / l2)) : 0
  return [a[0] + dx * t, a[1] + dz * t]
}

function segSegDist(a: P, b: P, c: P, d: P) {
  const o = (p: P, q: P, r: P) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
  if (o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0) return 0
  const dist = (p: P, s: P, e: P) => {
    const q = nearestOnSeg(p[0], p[1], s, e)
    return Math.hypot(p[0] - q[0], p[1] - q[1])
  }
  return Math.min(dist(a, c, d), dist(b, c, d), dist(c, a, b), dist(d, a, b))
}

/** 點 q 是否在相機背後（與視線夾角 > ~100°） */
function isBehind(qx: number, qz: number, dist: number) {
  if (dist < 1e-3) return true
  return (fpCam.fx * (qx - fpCam.x) + fpCam.fz * (qz - fpCam.z)) / dist < -0.2
}

/** 中心線 a→b、厚度 t 的牆：背後 < 0.8 m、包住相機、或橫在「相機 → 立足點」之間 → 應隱藏 */
export function wallBlocksCamera(a: P, b: P, t: number, wasHidden: boolean) {
  if (!fpCam.active) return false
  const q = nearestOnSeg(fpCam.x, fpCam.z, a, b)
  const d = Math.hypot(q[0] - fpCam.x, q[1] - fpCam.z)
  const surface = d - t / 2
  if (surface < 0.05) return true
  if (segSegDist([fpCam.x, fpCam.z], [fpCam.px, fpCam.pz], a, b) < t / 2 + 0.05) return true
  return surface < (wasHidden ? NEAR_BEHIND_SHOW : NEAR_BEHIND) && isBehind(q[0], q[1], d)
}

/** 旋轉矩形家具（中心 cx,cz；寬 w、深 d；rotationY 弧度）同上判斷 */
export function boxBlocksCamera(cx: number, cz: number, w: number, d: number, rot: number, wasHidden: boolean) {
  if (!fpCam.active) return false
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const dx = fpCam.x - cx
  const dz = fpCam.z - cz
  const lx = dx * c - dz * s
  const lz = dx * s + dz * c
  const kx = Math.max(-w / 2, Math.min(w / 2, lx))
  const kz = Math.max(-d / 2, Math.min(d / 2, lz))
  const dist = Math.hypot(lx - kx, lz - kz)
  if (dist < 0.05) return true // 相機在家具裡面（例如坐在沙發上往後退）
  const qx = cx + kx * c + kz * s
  const qz = cz - kx * s + kz * c
  return dist < (wasHidden ? NEAR_BEHIND_SHOW : NEAR_BEHIND) && isBehind(qx, qz, dist)
}
