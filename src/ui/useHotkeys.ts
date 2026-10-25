import { useEffect } from 'react'
import { togglePlanView, deleteSelected, duplicateSelected, exportLayout, rotateSelected, toggleMoving } from '../store/actions'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/** M 進入/離開移動模式、R 旋轉 90°（Shift+R 反向）、Backspace/Delete 刪除、Space 切換平面圖、Ctrl+Z/Y 復原、Ctrl+D 複製、Ctrl+S 匯出、Esc 取消選取 */
export function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      const L = useLayout.getState()

      if (mod && k === 'z') {
        e.preventDefault()
        e.shiftKey ? L.redo() : L.undo()
      } else if (mod && k === 'y') {
        e.preventDefault()
        L.redo()
      } else if (mod && k === 'd') {
        e.preventDefault()
        duplicateSelected()
      } else if (mod && k === 's') {
        e.preventDefault()
        exportLayout()
      } else if (mod || e.altKey) {
        return
      } else if (k === 'm') {
        toggleMoving()
      } else if (e.key === 'Enter' && useUi.getState().moving) {
        toggleMoving(false)
      } else if (k === 'r') {
        rotateSelected(e.shiftKey ? -90 : 90)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        deleteSelected()
      } else if (e.key === ' ') {
        if (useUi.getState().viewMode === 'firstPerson') return
        if ((e.target as HTMLElement | null)?.tagName === 'BUTTON') return
        e.preventDefault()
        togglePlanView()
      } else if (e.key === 'Escape') {
        const ui = useUi.getState()
        if (ui.viewMode === 'firstPerson') ui.setViewMode('isometric')
        else if (ui.calib.active) ui.endCalib()
        else if (ui.moving) ui.setMoving(false)
        else ui.select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
