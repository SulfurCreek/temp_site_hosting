export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('無法載入圖片'))
    img.src = url
  })
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

/**
 * 使用者上傳的圖檔 → data URL。點陣圖會縮到 maxSize 以內以節省 LocalStorage；
 * PNG/WebP 保留 alpha（去背商品照需要），其餘輸出 JPEG。SVG 原樣保留。
 */
export async function fileToDataUrl(file: File, maxSize = 2048): Promise<string> {
  const raw = await readAsDataUrl(file)
  if (file.type === 'image/svg+xml') return raw
  const img = await loadImage(raw)
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
  if (scale === 1 && file.size < 400_000) return raw
  const cv = document.createElement('canvas')
  cv.width = Math.round(img.naturalWidth * scale)
  cv.height = Math.round(img.naturalHeight * scale)
  cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height)
  const alpha = file.type === 'image/png' || file.type === 'image/webp'
  return alpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.88)
}

/** 從圖片裁出矩形（原圖像素座標）→ JPEG data URL，長邊最多 outMax */
export function cropToDataUrl(
  img: HTMLImageElement,
  rect: { x: number; y: number; w: number; h: number },
  outMax = 768,
): string {
  const scale = Math.min(1, outMax / Math.max(rect.w, rect.h))
  const cv = document.createElement('canvas')
  cv.width = Math.max(1, Math.round(rect.w * scale))
  cv.height = Math.max(1, Math.round(rect.h * scale))
  cv.getContext('2d')!.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, cv.width, cv.height)
  return cv.toDataURL('image/jpeg', 0.9)
}

export async function imageAspect(url: string): Promise<number> {
  const img = await loadImage(url)
  return img.naturalWidth / Math.max(1, img.naturalHeight)
}

/** 觸發瀏覽器下載文字檔 */
export function downloadText(filename: string, text: string, mime = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
