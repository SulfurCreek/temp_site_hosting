/** 色溫 (K) → sRGB hex。Tanner Helland 近似式，適用 1000–40000K。 */
export function kelvinToHex(k: number): string {
  const t = k / 100
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return '#' + [r, g, b].map((v) => c(v).toString(16).padStart(2, '0')).join('')
}

export function isHex(s: string) {
  return /^#[0-9a-f]{6}$/i.test(s)
}
