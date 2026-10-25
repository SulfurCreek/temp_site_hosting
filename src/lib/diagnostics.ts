import type { WebGLRenderer } from 'three'
import { create } from 'zustand'

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
