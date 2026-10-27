import type { WebGLRenderer } from 'three'
import { create } from 'zustand'
import { LEAN } from './lean'

/**
 * 渲染診斷：收集 WebGL 能力、three.js 的錯誤 / 警告、未捕捉的例外與 context lost，
 * 在畫面上顯示可複製的報告（手機沒有 DevTools 時回報用）。網址加 ?debug=1 會一律顯示報告按鈕。
 */
export interface DiagItem {
  t: number
  kind: string
  msg: string
}

interface DiagState {
  items: DiagItem[]
  contextLost: boolean
  caps: Record<string, string | number | boolean> | null
  /** 偵測到 framebuffer / shader 類錯誤：後製管線改走安全路徑（只用 renderer 色調映射） */
  postBroken: boolean
  /** 設備是否支援 float 渲染目標（N8AO 半解析度的深度降採樣需要） */
  floatRT: boolean
}

export const useDiag = create<DiagState>(() => ({ items: [], contextLost: false, caps: null, postBroken: false, floatRT: true }))

const STORE_KEY = 'interior-planner:diag'
const SAFE_KEY = 'interior-planner:safe'
const RELOAD_KEY = 'interior-planner:autoreload'

/**
 * 手動降級（預設關閉，不會自動啟用）：網址加 ?lq=1|2|3 才會生效並記住；?hq=1 重設。
 * 0 = 完整；1 = 解析度上限 1.5；2 = 再關閉後製（AO / 景深 / Bloom）；3 = 再關閉陰影、解析度 1。
 */
export function getSafeLevel(): 0 | 1 | 2 | 3 {
  try {
    const m = /[?&]lq=([123])/.exec(location.search)
    if (m) localStorage.setItem(SAFE_KEY, m[1])
    if (/[?&]hq=1/.test(location.search)) {
      localStorage.removeItem(SAFE_KEY)
      sessionStorage.removeItem(RELOAD_KEY)
      return 0
    }
    const n = Number(localStorage.getItem(SAFE_KEY) ?? 0)
    return (n >= 3 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0) as 0 | 1 | 2 | 3
  } catch {
    return 0
  }
}
export function resetSafeLevel() {
  try {
    localStorage.removeItem(SAFE_KEY)
    sessionStorage.removeItem(RELOAD_KEY)
  } catch {
    /* ignore */
  }
  location.reload()
}
/** 建立 WebGL 失敗時等幾秒再重試一次（每個分頁最多 2 次；給系統時間釋放上一頁的 GPU 記憶體） */
export function retryLater() {
  try {
    const n = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (n >= 2) return
    sessionStorage.setItem(RELOAD_KEY, String(n + 1))
    setTimeout(() => location.reload(), 4000)
  } catch {
    /* ignore */
  }
}
const IGNORE = /THREE\.Clock|THREE\.Timer|ErrorBoundary/
const BAD = /framebuffer|incomplete|program info log|shader|compile|link|INVALID_|GL_INVALID|context lost|out of memory/i

export function reportDiag(kind: string, msg: string) {
  msg = String(msg).slice(0, 600)
  if (IGNORE.test(msg)) return
  const s = useDiag.getState()
  if (s.items.some((i) => i.msg === msg)) return
  const items = [...s.items.slice(-39), { t: Date.now(), kind, msg }]
  useDiag.setState({ items, ...(BAD.test(msg) && kind !== 'info' ? { postBroken: true } : {}) })
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ at: new Date().toISOString(), ua: navigator.userAgent, items }))
  } catch {
    /* 私密模式或容量滿：忽略 */
  }
}

let installed = false
export function installDiagnostics() {
  if (installed || typeof window === 'undefined') return
  installed = true
  window.addEventListener('error', (e) => reportDiag('error', `${e.message} @${(e.filename ?? '').split('/').pop()}:${e.lineno}`))
  window.addEventListener('unhandledrejection', (e) => reportDiag('rejection', String((e.reason as Error)?.message ?? e.reason)))
  for (const k of ['error', 'warn'] as const) {
    const orig = console[k].bind(console)
    console[k] = (...a: unknown[]) => {
      orig(...a)
      const msg = a.map((x) => (x instanceof Error ? x.message : typeof x === 'string' ? x : '')).join(' ').trim()
      if (msg && /THREE\.|WebGL|framebuffer|shader/i.test(msg)) reportDiag(k, msg)
    }
  }
}

/** 建立 renderer 後呼叫：記錄 GPU / 擴充 / 限制，掛上 context lost 監聽 */
export function collectCaps(gl: WebGLRenderer, onRestore: () => void) {
  const c = gl.getContext() as WebGL2RenderingContext
  const dbg = c.getExtension('WEBGL_debug_renderer_info')
  const has = (n: string) => !!c.getExtension(n)
  const floatRT = has('EXT_color_buffer_float')
  const caps = {
    ua: navigator.userAgent,
    gpu: dbg ? String(c.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(c.getParameter(c.RENDERER)),
    webgl2: typeof WebGL2RenderingContext !== 'undefined' && c instanceof WebGL2RenderingContext,
    dpr: window.devicePixelRatio,
    screen: `${screen.width}x${screen.height}`,
    maxTextureSize: c.getParameter(c.MAX_TEXTURE_SIZE) as number,
    maxTextureUnits: c.getParameter(c.MAX_TEXTURE_IMAGE_UNITS) as number,
    maxFragmentUniformVectors: c.getParameter(c.MAX_FRAGMENT_UNIFORM_VECTORS) as number,
    maxSamples: c.getParameter(c.MAX_SAMPLES) as number,
    maxDrawBuffers: c.getParameter(c.MAX_DRAW_BUFFERS) as number,
    EXT_color_buffer_float: floatRT,
    EXT_color_buffer_half_float: has('EXT_color_buffer_half_float'),
    OES_texture_float_linear: has('OES_texture_float_linear'),
    OES_texture_half_float_linear: has('OES_texture_half_float_linear'),
    EXT_texture_filter_anisotropic: has('EXT_texture_filter_anisotropic'),
  }
  useDiag.setState({ caps, floatRT })
  const el = gl.domElement
  el.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    useDiag.setState({ contextLost: true })
    reportDiag('context', 'WebGL context lost（通常是記憶體不足或 GPU 被系統回收）')
  })
  el.addEventListener('webglcontextrestored', () => {
    useDiag.setState({ contextLost: false })
    onRestore()
  })
}

export function diagReport() {
  const s = useDiag.getState()
  return JSON.stringify({ at: new Date().toISOString(), caps: s.caps, contextLost: s.contextLost, postBroken: s.postBroken, items: s.items }, null, 2)
}

const ATTR_TRIES: WebGLContextAttributes[] = [
  { powerPreference: 'high-performance', antialias: false, stencil: false, depth: true },
  { antialias: false, stencil: false, depth: true },
  { antialias: false },
]

/** 在拋棄式 canvas 上試建 WebGL2 並驗證可用（getShaderPrecisionFormat 非 null、未 lost）；回傳第一組可用屬性，全部失敗回 null */
export async function probeWebGL(): Promise<WebGLContextAttributes | null> {
  // 行動端輕量管線不掛後製，抗鋸齒改用原生 MSAA，所以先探測 antialias: true
  const tries = LEAN ? [{ powerPreference: 'high-performance', antialias: true, stencil: false, depth: true } as WebGLContextAttributes, ...ATTR_TRIES] : ATTR_TRIES
  for (let round = 0; round < 3; round++) {
    for (const a of tries) {
      const cv = document.createElement('canvas')
      let ok = false
      try {
        const c = cv.getContext('webgl2', a) as WebGL2RenderingContext | null
        ok = !!c && !c.isContextLost() && !!c.getShaderPrecisionFormat(c.VERTEX_SHADER, c.HIGH_FLOAT) && !!c.getShaderPrecisionFormat(c.FRAGMENT_SHADER, c.HIGH_FLOAT)
        if (!ok) reportDiag('probe', `WebGL2 探測失敗 ${JSON.stringify(a)}：${c ? (c.isContextLost() ? 'context 已失效' : 'precision=null') : 'getContext 回傳 null'}`)
        c?.getExtension('WEBGL_lose_context')?.loseContext()
      } catch (e) {
        reportDiag('probe', `WebGL2 探測例外：${(e as Error).message}`)
      }
      if (ok) {
        if (a !== tries[0]) reportDiag('info', `改用較保守的 WebGL 屬性 ${JSON.stringify(a)}`)
        return a
      }
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  return null
}
