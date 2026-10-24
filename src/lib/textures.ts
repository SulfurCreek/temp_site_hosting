import * as THREE from 'three'
import { getBuiltinCanvas } from './proceduralTextures'

const baseCache = new Map<string, Promise<THREE.Texture>>()

function finalize(t: THREE.Texture) {
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
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
