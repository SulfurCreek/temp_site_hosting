import { useEffect, useState } from 'react'
import type { ReferenceImage } from '../types'

export function useMediaQuery(query: string) {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const mq = window.matchMedia(query)
    const f = () => setM(mq.matches)
    f()
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [query])
  return m
}

/** < 1024px 視為手機/平板：改用底部抽屜 */
export const useIsMobile = () => useMediaQuery('(max-width: 1023px)')

export interface ManifestEntry {
  name: string
  url: string
  kind: 'image' | 'model'
}
export type Manifest = Record<'floorplans' | 'references' | 'products', ManifestEntry[]>

let manifestPromise: Promise<Manifest> | null = null
const EMPTY: Manifest = { floorplans: [], references: [], products: [] }

/** 讀取 /inputs/manifest.json（由 vite plugin 掃描 public/inputs/* 產生） */
export function useManifest() {
  const [m, setM] = useState<Manifest>(EMPTY)
  useEffect(() => {
    manifestPromise ??= fetch('/inputs/manifest.json', { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : EMPTY))
      .catch(() => EMPTY)
    let alive = true
    manifestPromise.then((v) => alive && setM(v))
    return () => {
      alive = false
    }
  }, [])
  return m
}

export function refFromEntry(e: ManifestEntry): ReferenceImage {
  return { id: 'm:' + e.url, name: e.name, url: e.url }
}
