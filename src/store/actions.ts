import { downloadText } from '../lib/image'
import type { CatalogItem, MaterialSpec, ViewPreset } from '../types'
import { viewTarget } from '../scene/CameraRig'
import { findCatalogItem, useLayout } from './layoutStore'
import { useUi } from './uiStore'

export const VIEW_CYCLE: ViewPreset[] = ['SE', 'SW', 'NW', 'NE', 'TOP']

export function cycleView() {
  const ui = useUi.getState()
  // 以「上一次請求的視角」為基準，連按空白鍵時不會因為轉場尚未結束而重複
  const cur = ui.viewRequest.preset
  ui.requestView(VIEW_CYCLE[(VIEW_CYCLE.indexOf(cur) + 1) % VIEW_CYCLE.length])
}

export function selectedFurnitureId() {
  const s = useUi.getState().selection
  return s?.type === 'furniture' ? s.id : null
}

function lockedGuard(id: string) {
  const f = useLayout.getState().layout.furniture.find((x) => x.id === id)
  if (f?.locked) {
    useUi.getState().showToast(`「${f.name}」已鎖定，請先在屬性面板解除鎖定`)
    return true
  }
  return false
}

export function rotateSelected(deg: number) {
  const id = selectedFurnitureId()
  if (id && !lockedGuard(id)) useLayout.getState().rotateFurniture(id, deg)
}

/** 進入 / 離開移動模式（鎖定的物件無法移動） */
export function toggleMoving(force?: boolean) {
  const ui = useUi.getState()
  const id = selectedFurnitureId()
  if (!id) return
  const next = force ?? !ui.moving
  if (next && lockedGuard(id)) return
  ui.setMoving(next)
}

export function deleteSelected() {
  const id = selectedFurnitureId()
  if (!id || lockedGuard(id)) return
  useLayout.getState().removeFurniture(id)
  useUi.getState().select(null)
}

export function duplicateSelected() {
  const id = selectedFurnitureId()
  if (!id) return
  const nid = useLayout.getState().duplicateFurniture(id)
  if (nid) useUi.getState().select({ type: 'furniture', id: nid })
}

export function addFromCatalog(item: CatalogItem) {
  // 放在「目前畫面中央」對準的地面點；與既有家具重疊時往右下錯開
  const fur = useLayout.getState().layout.furniture
  let x = Math.round(viewTarget.x * 20) / 20
  let z = Math.round(viewTarget.z * 20) / 20
  while (fur.some((f) => Math.abs(f.position[0] - x) < 0.05 && Math.abs(f.position[2] - z) < 0.05)) {
    x += 0.3
    z += 0.3
  }
  const id = useLayout.getState().addFurniture(item, [x, 0, z])
  useUi.getState().select({ type: 'furniture', id })
  return id
}

export function exportLayout() {
  const { layout } = useLayout.getState()
  downloadText('layout.json', JSON.stringify(layout, null, 2))
  useUi.getState().showToast('已匯出 layout.json')
}

export async function importLayoutFile(file: File) {
  try {
    const raw = JSON.parse(await file.text())
    useLayout.getState().loadLayout(raw)
    useUi.getState().select(null)
    useUi.getState().showToast(`已匯入「${file.name}」`)
  } catch (e) {
    useUi.getState().showToast('匯入失敗：' + (e as Error).message)
  }
}

export function resetLayout() {
  if (!window.confirm('要還原成預設客廳格局嗎？（可用 Ctrl+Z 復原）')) return
  useLayout.getState().resetLayout()
  useUi.getState().select(null)
}

/** 把參考圖吸管取到的顏色套用到目前選取物件的主要材質 */
export function applyColorToSelection(hex: string) {
  const sel = useUi.getState().selection
  const st = useLayout.getState()
  if (!sel) {
    useUi.getState().showToast('請先點選牆壁、地板或家具')
    return
  }
  const patch = (m: MaterialSpec): MaterialSpec => ({ ...m, color: hex })
  if (sel.type === 'wall') {
    const w = st.layout.walls.find((x) => x.id === sel.id)
    if (w) st.updateWall(w.id, { material: patch(w.material) })
  } else if (sel.type === 'zone') {
    const z = st.layout.floorZones?.find((x) => x.id === sel.id)
    if (z) st.updateZone(z.id, { material: patch(z.material) })
  } else if (sel.type === 'floor') {
    st.updateFloor({ material: patch(st.layout.floor.material) })
  } else {
    const f = st.layout.furniture.find((x) => x.id === sel.id)
    const item = f && findCatalogItem(f.catalogId, st.layout.customCatalog)
    const base = f?.materials?.main ?? item?.parametric?.materials.main
    if (f && base) st.updateFurniture(f.id, { materials: { ...f.materials, main: patch(base) } })
    else useUi.getState().showToast('此家具沒有可上色的材質（GLB / 立牌）')
  }
}
