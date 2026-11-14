/**
 * GPU 記憶體瘦身（畫面輸出不變）。iPhone Safari 的 WebGL 在總配置量過高時會直接收掉 context，
 * 這裡把「有配置、但內容從來不會被讀取或重複一份」的緩衝拿掉。每項的估算以 iPhone 15 Pro、dpr 2（786×1704）為準。
 *
 * 1. N8AO 後製：合成結果先畫進自己的全解析度 RGBA16F 再複製到 outputBuffer → 改成直接畫進 outputBuffer，省 10 MB 與每幀一次全螢幕複製。
 * 2. N8AO 累積緩衝：accumulate 關閉時只是把 8-bit 的 AO 結果原樣複製一次，用 RGBA16F 存放沒有多出任何精度 → 改 RGBA8，省 5 MB。
 * 3. EffectComposer 的 stable depth 目標只用深度，色彩附件從 RGBA8 改成 R8 → 省 4 MB。
 * 4. 點光源陰影（cube map）只用深度，three.js 預設仍配置 6 面 RGBA8 色彩附件（1024² × 6 × 4 B = 24 MB / 盞）→ 改 R8，每盞省 18 MB。
 */
import { EffectComposer } from 'postprocessing'
import * as THREE from 'three'

type ComposerInternals = { createDepthTexture(): void; depthRenderTarget: THREE.WebGLRenderTarget | null }
const proto = EffectComposer.prototype as unknown as ComposerInternals & { __lean?: boolean }
if (!proto.__lean) {
  proto.__lean = true
  const orig = proto.createDepthTexture
  proto.createDepthTexture = function (this: ComposerInternals) {
    orig.call(this)
    const t = this.depthRenderTarget?.texture
    if (t) {
      t.format = THREE.RedFormat
      t.type = THREE.UnsignedByteType
      t.generateMipmaps = false
    }
  }
}

interface N8AOLike {
  outputTargetInternal: THREE.WebGLRenderTarget
  accumulationRenderTarget: THREE.WebGLRenderTarget
  copyQuad: { render(renderer: THREE.WebGLRenderer): void }
  renderToScreen: boolean
  render(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget, outputBuffer: THREE.WebGLRenderTarget, ...rest: unknown[]): void
  __lean?: boolean
}

/**
 * N8AOPostPass：
 * - 合成結果原本先畫到自己的全解析度 outputTargetInternal（與 inputBuffer 同為 RGBA16F）再複製到 outputBuffer。
 *   改成直接畫進 outputBuffer 並略過那次複製（複製是 1:1 取樣，結果逐位相同）。
 * - accumulationRenderTarget 改 RGBA8（內容是 8-bit AO 的原樣複製）。
 */
export function leanN8AO(pass: unknown) {
  const p = pass as N8AOLike | null
  if (!p || p.__lean) return
  p.__lean = true
  const acc = p.accumulationRenderTarget
  acc.texture.type = THREE.UnsignedByteType
  acc.dispose()
  const own = p.outputTargetInternal
  const render = p.render.bind(p)
  const copy = p.copyQuad.render.bind(p.copyQuad)
  let direct = false
  p.copyQuad.render = (renderer) => {
    if (!direct) copy(renderer)
  }
  p.render = (renderer, inputBuffer, outputBuffer, ...rest) => {
    direct = !p.renderToScreen && !!outputBuffer
    if (direct) {
      if (p.outputTargetInternal === own) own.dispose()
      p.outputTargetInternal = outputBuffer
    } else p.outputTargetInternal = own
    render(renderer, inputBuffer, outputBuffer, ...rest)
  }
}

/**
 * 點光源陰影：在 three.js 建立預設 cube 陰影圖之前，先放一個「深度 + R8 色彩」的版本。
 * 深度貼圖的格式、比較函式、濾波與 WebGLShadowMap（PCF）預設完全相同，陰影結果不變。
 */
export function leanPointShadow(light: THREE.PointLight | null) {
  if (!light || !light.castShadow) return
  const s = light.shadow
  if (s.map) return
  const size = s.mapSize.x
  const rt = new THREE.WebGLCubeRenderTarget(size, {
    format: THREE.RedFormat,
    type: THREE.UnsignedByteType,
    generateMipmaps: false,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
  })
  const depth = new THREE.CubeDepthTexture(size, THREE.UnsignedIntType)
  depth.name = light.name + '.shadowMap'
  depth.format = THREE.DepthFormat
  depth.compareFunction = THREE.LessEqualCompare
  depth.minFilter = THREE.LinearFilter
  depth.magFilter = THREE.LinearFilter
  rt.depthTexture = depth as unknown as THREE.DepthTexture
  s.map = rt as unknown as THREE.WebGLRenderTarget
  s.camera.updateProjectionMatrix()
}
