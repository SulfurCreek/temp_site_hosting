import * as THREE from 'three'
import { LEAN } from './lean'
import { getBuiltinCanvas } from './proceduralTextures'

const baseCache = new Map<string, Promise<THREE.Texture>>()

function finalize(t: THREE.Texture) {
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = LEAN ? 4 : 8
  t.needsUpdate = true
  return t
}

/** 載入並快取「基底貼圖」。實際使用時請 clone() 再設定 repeat，避免互相影響。 */
export function loadBaseTexture(url: string): Promise<THREE.Texture> {
  let p = baseCache.get(url)
  if (!p) {
    p = new Promise<THREE.Texture>((resolve, reject) => {
      if (url.startsWith('builtin:')) {
        const cv = getBuiltinCanvas(url)
        if (!cv) return reject(new Error(`unknown builtin texture ${url}`))
        resolve(finalize(new THREE.CanvasTexture(cv)))
        return
      }
      new THREE.TextureLoader().load(url, (t) => resolve(finalize(t)), undefined, () =>
        reject(new Error(`failed to load texture ${url}`)),
      )
    })
    baseCache.set(url, p)
    p.catch(() => baseCache.delete(url))
  }
  return p
}

/**
 * clone 一張已載入的貼圖給另一個材質（各自的 repeat / offset）。clone 共用同一個 Source，
 * three.js 只會配置一份 GPU 記憶體；這裡只讓 clone 的 version > 0 以便被綁定，
 * 不碰 source.needsUpdate（那會讓共用的大圖重新上傳、重新產生 mipmap）。
 */
export function sharedClone<T extends THREE.Texture>(base: T): T {
  const k = base.clone() as T
  k.version = Math.max(1, base.version)
  return k
}
