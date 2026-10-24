import type { StateStorage } from 'zustand/middleware'

/**
 * localStorage 包裝：
 * - 寫入 debounce（拖拉/滑桿期間不會每幀序列化整份格局）
 * - 讀寫例外（隱私模式、配額滿）不會讓 App 崩潰，改以 window 事件通知 UI
 */
let timer: ReturnType<typeof setTimeout> | undefined
let pending: { name: string; value: string } | null = null

function flush() {
  if (!pending) return
  const { name, value } = pending
  pending = null
  try {
    localStorage.setItem(name, value)
  } catch (e) {
    window.dispatchEvent(
      new CustomEvent('app:toast', {
        detail: '自動儲存失敗（可能是容量已滿，請改用「匯出 layout.json」備份）',
      }),
    )
    console.warn('[persist]', e)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
}

export const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    pending = { name, value }
    clearTimeout(timer)
    timer = setTimeout(flush, 400)
  },
  removeItem: (name) => {
    pending = null
    try {
      localStorage.removeItem(name)
    } catch {
      /* ignore */
    }
  },
}
