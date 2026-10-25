import { Check, Copy, DoorOpen, Lock, LockOpen, MousePointer2, Move, Plus, RotateCcw, RotateCw, Square, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { uid } from '../lib/ids'
import { DEFAULT_MATERIAL } from '../lib/materials'
import { deleteSelected, duplicateSelected, rotateSelected, toggleMoving } from '../store/actions'
import { findCatalogItem, useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import type { Decal, FaceName, FurnitureInstance, MaterialSpec, Opening, Wall } from '../types'
import { AssetGrid, UploadButton } from './assets'
import { Btn, Field, NumberField, Section, Segmented, TextField, Toggle } from './controls'
import { MaterialEditor } from './MaterialEditor'

const FACE_LABEL: Record<FaceName, string> = { front: '正面', back: '背面', left: '左側', right: '右側', top: '頂面' }

function Empty() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm text-slate-400">
      <MousePointer2 size={28} className="text-slate-500" />
      <p>點選場景中的牆壁、地板或家具，即可在這裡調整尺寸、座標、角度與材質。</p>
    </div>
  )
}

/* ------------------------------ 家具 ------------------------------ */

function FurnitureProps({ f }: { f: FurnitureInstance }) {
  const update = useLayout((s) => s.updateFurniture)
  const custom = useLayout((s) => s.layout.customCatalog)
  const item = findCatalogItem(f.catalogId, custom)
  const moving = useUi((s) => s.moving)
  const [slot, setSlot] = useState<'main' | 'secondary' | 'accent'>('main')
  const [decalFace, setDecalFace] = useState<FaceName>('front')
  const k = 'f-' + f.id

  const slotSpec: MaterialSpec =
    f.materials?.[slot] ??
    item?.parametric?.materials[slot] ??
    item?.parametric?.materials.main ??
    DEFAULT_MATERIAL

  const decals = f.decals ?? item?.parametric?.decals ?? []
  const setDecals = (d: Decal[]) => update(f.id, { decals: d })
  const setSize = (i: 0 | 1 | 2, v: number) => update(f.id, { size: f.size.map((x, j) => (j === i ? v : x)) as FurnitureInstance['size'] }, k + 'size')
  const setPos = (i: 0 | 1 | 2, v: number) =>
    update(f.id, { position: f.position.map((x, j) => (j === i ? v : x)) as FurnitureInstance['position'] }, k + 'pos')

  return (
    <>
      <Section title="基本" defaultOpen>
        <TextField label="名稱" value={f.name} onChange={(v) => update(f.id, { name: v }, k + 'name')} />
        <p className="text-[11px] text-slate-500">
          類型：{item ? `${item.name}（${item.mode === 'glb' ? '.glb 模型' : item.mode === 'billboard' ? '2.5D 立牌' : '參數化 PBR 積木'}）` : '目錄中找不到此商品'}
        </p>
        <Btn
          variant={moving ? 'primary' : 'default'}
          className="w-full py-2 text-sm"
          disabled={f.locked}
          title={f.locked ? '已鎖定，請先解除鎖定' : '進入移動模式後再拖拉（M 鍵）'}
          onClick={() => toggleMoving()}
        >
          {moving ? <Check size={15} /> : <Move size={15} />}
          {moving ? '完成移動（Enter）' : f.locked ? '已鎖定，無法移動' : '移動（M）'}
        </Btn>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={duplicateSelected}>
            <Copy size={14} /> 複製
          </Btn>
          <Btn onClick={() => update(f.id, { locked: !f.locked })}>
            {f.locked ? <Lock size={14} /> : <LockOpen size={14} />}
            {f.locked ? '已鎖定' : '鎖定'}
          </Btn>
          <Btn variant="danger" onClick={deleteSelected} disabled={f.locked}>
            <Trash2 size={14} /> 刪除
          </Btn>
        </div>
      </Section>

      <Section title="尺寸（公分）">
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="寬 X" value={f.size[0]} scale={100} min={1} unit="cm" onChange={(v) => setSize(0, v)} />
          <NumberField label="高 Y" value={f.size[1]} scale={100} min={1} unit="cm" onChange={(v) => setSize(1, v)} />
          <NumberField label="深 Z" value={f.size[2]} scale={100} min={1} unit="cm" onChange={(v) => setSize(2, v)} />
        </div>
      </Section>

      <Section title="座標與旋轉">
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="X（東+）" value={f.position[0]} scale={100} unit="cm" onChange={(v) => setPos(0, v)} />
          <NumberField label="離地 Y" value={f.position[1]} scale={100} unit="cm" onChange={(v) => setPos(1, Math.max(0, v))} />
          <NumberField label="Z（南+）" value={f.position[2]} scale={100} unit="cm" onChange={(v) => setPos(2, v)} />
        </div>
        <NumberField label="旋轉角度" value={f.rotationY} unit="°" step={5} onChange={(v) => update(f.id, { rotationY: v }, k + 'rot')} />
        <div className="grid grid-cols-5 gap-1.5">
          <Btn onClick={() => rotateSelected(-90)} title="逆時針 90°（Shift+R）">
            <RotateCcw size={13} />90
          </Btn>
          <Btn onClick={() => rotateSelected(-45)}>
            <RotateCcw size={13} />45
          </Btn>
          <Btn onClick={() => update(f.id, { rotationY: 0 })}>0°</Btn>
          <Btn onClick={() => rotateSelected(45)}>
            <RotateCw size={13} />45
          </Btn>
          <Btn onClick={() => rotateSelected(90)} title="順時針 90°（R）">
            <RotateCw size={13} />90
          </Btn>
        </div>
        {item?.mode === 'billboard' && (
          <Toggle label="立牌持續朝向鏡頭" checked={!!f.faceCamera} onChange={(v) => update(f.id, { faceCamera: v })} />
        )}
      </Section>

      {item?.notes && item.notes.length > 0 && (
        <Section title="施工圖規格備註">
          <ul className="list-disc space-y-1 pl-4 text-[11px] leading-relaxed text-slate-300">
            {item.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Section>
      )}
      {item?.mode === 'parametric' && (
        <>
          <Section title="材質貼皮 / 油漆">
            <Segmented
              value={slot}
              onChange={setSlot}
              options={[
                { value: 'main', label: '主體' },
                { value: 'secondary', label: '次要' },
                { value: 'accent', label: '點綴' },
              ]}
            />
            <MaterialEditor
              brandKinds={['board', 'paint', 'fabric']}
              key={f.id + slot}
              spec={slotSpec}
              onChange={(p) => update(f.id, { materials: { ...f.materials, [slot]: { ...slotSpec, ...p } } }, k + 'mat' + slot)}
            />
          </Section>

          <Section title="商品照貼面" defaultOpen={false}>
            <p className="text-[11px] leading-relaxed text-slate-500">把商品照 / 設計圖直接貼在家具的指定表面（例如櫃門、桌面）。</p>
            {decals.map((d, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md bg-slate-800/70 p-1.5">
                <img src={d.url} alt="" className="h-10 w-10 rounded object-cover" />
                <span className="flex-1 text-xs text-slate-300">{FACE_LABEL[d.face]}</span>
                <select
                  value={d.fit ?? 'cover'}
                  onChange={(e) => setDecals(decals.map((x, j) => (j === i ? { ...x, fit: e.target.value as Decal['fit'] } : x)))}
                  className="rounded bg-slate-700 px-1 py-1 text-xs text-slate-100"
                >
                  <option value="cover">填滿裁切</option>
                  <option value="contain">完整顯示</option>
                  <option value="stretch">拉伸</option>
                </select>
                <button className="p-1 text-slate-400 hover:text-red-300" onClick={() => setDecals(decals.filter((_, j) => j !== i))}>
                  <X size={14} />
                </button>
              </div>
            ))}
            <Field label="貼在哪個面">
              <Segmented
                small
                value={decalFace}
                onChange={setDecalFace}
                options={(Object.keys(FACE_LABEL) as FaceName[]).map((v) => ({ value: v, label: FACE_LABEL[v] }))}
              />
            </Field>
            <UploadButton
              label="上傳商品照"
              maxSize={1280}
              onUrl={(url) => setDecals([...decals.filter((d) => d.face !== decalFace), { face: decalFace, url, fit: 'cover' }])}
            />
            <AssetGrid
              kind="products"
              empty="public/inputs/products/ 內放入商品去背照（PNG）後，可在此直接貼上。"
              onPick={(e) => setDecals([...decals.filter((d) => d.face !== decalFace), { face: decalFace, url: e.url, fit: 'cover' }])}
            />
          </Section>
        </>
      )}
      {item?.mode === 'glb' && (
        <Section title="GLB 模型">
          <p className="text-[11px] leading-relaxed text-slate-400">
            模型會依上方「寬/高/深」精準縮放到指定尺寸（stretch）。檔案：<span className="break-all text-slate-300">{item.glb?.url}</span>
          </p>
        </Section>
      )}
      {item?.mode === 'billboard' && (
        <Section title="2.5D 立牌">
          <p className="text-[11px] leading-relaxed text-slate-400">
            圖片：<span className="break-all text-slate-300">{item.billboard?.image.startsWith('data:') ? '（上傳的圖片）' : item.billboard?.image}</span>
            <br />
            虛線框為真實長寬高的碰撞體積，可用來先佔位檢視配色與比例；之後再換成 .glb。
          </p>
        </Section>
      )}
    </>
  )
}

/* ------------------------------ 牆 ------------------------------ */

function WallProps({ w }: { w: Wall }) {
  const update = useLayout((s) => s.updateWall)
  const k = 'w-' + w.id
  const len = Math.hypot(w.end[0] - w.start[0], w.end[1] - w.start[1])
  const setPt = (which: 'start' | 'end', i: 0 | 1, v: number) =>
    update(w.id, { [which]: w[which].map((x, j) => (j === i ? v : x)) as Wall['start'] }, k + which)
  const setOp = (id: string, p: Partial<Opening>) =>
    update(w.id, { openings: w.openings.map((o) => (o.id === id ? { ...o, ...p } : o)) }, k + 'op' + id)
  const addOp = (type: Opening['type']) =>
    update(w.id, {
      openings: [
        ...w.openings,
        {
          id: uid(type === 'door' ? 'door' : 'win'),
          type,
          at: len / 2,
          width: type === 'door' ? 0.9 : 1.2,
          height: type === 'door' ? 2.1 : 1.2,
          sill: type === 'door' ? 0 : 0.9,
        },
      ],
    })

  return (
    <>
      <Section title="牆壁">
        <TextField label="名稱" value={w.name} onChange={(v) => update(w.id, { name: v }, k + 'name')} />
        <p className="text-xs text-slate-400">長度：{(len * 100).toFixed(1)} cm</p>
        <Toggle label="外牆（參與智慧破牆）" checked={w.exterior} onChange={(v) => update(w.id, { exterior: v })} />
      </Section>
      <Section title="尺寸與座標（公分）">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="高度" value={w.height} scale={100} min={10} unit="cm" onChange={(v) => update(w.id, { height: v }, k + 'h')} />
          <NumberField label="厚度" value={w.thickness} scale={100} min={2} unit="cm" onChange={(v) => update(w.id, { thickness: v }, k + 't')} />
          <NumberField label="起點 X" value={w.start[0]} scale={100} unit="cm" onChange={(v) => setPt('start', 0, v)} />
          <NumberField label="起點 Z" value={w.start[1]} scale={100} unit="cm" onChange={(v) => setPt('start', 1, v)} />
          <NumberField label="終點 X" value={w.end[0]} scale={100} unit="cm" onChange={(v) => setPt('end', 0, v)} />
          <NumberField label="終點 Z" value={w.end[1]} scale={100} unit="cm" onChange={(v) => setPt('end', 1, v)} />
        </div>
      </Section>
      <Section title={`門窗開口（${w.openings.length}）`} icon={<DoorOpen size={15} />} defaultOpen={false}>
        {w.openings.map((o) => (
          <div key={o.id} className="space-y-2 rounded-md bg-slate-800/60 p-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>{o.type === 'door' ? '門' : '窗'}</span>
              <button className="text-slate-400 hover:text-red-300" onClick={() => update(w.id, { openings: w.openings.filter((x) => x.id !== o.id) })}>
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="中心位置" value={o.at} scale={100} unit="cm" onChange={(v) => setOp(o.id, { at: v })} />
              <NumberField label="寬" value={o.width} scale={100} min={10} unit="cm" onChange={(v) => setOp(o.id, { width: v })} />
              <NumberField label="高" value={o.height} scale={100} min={10} unit="cm" onChange={(v) => setOp(o.id, { height: v })} />
              <NumberField label="離地" value={o.sill} scale={100} min={0} unit="cm" onChange={(v) => setOp(o.id, { sill: v })} />
            </div>
          </div>
        ))}
        <div className="flex gap-2">
          <Btn onClick={() => addOp('window')}>
            <Plus size={13} /> 窗
          </Btn>
          <Btn onClick={() => addOp('door')}>
            <Plus size={13} /> 門
          </Btn>
        </div>
      </Section>
      <Section title="牆面油漆 / 材質">
        <MaterialEditor key={w.id} paint brandKinds={['paint', 'board']} spec={w.material} onChange={(p) => update(w.id, { material: { ...w.material, ...p } }, k + 'mat')} />
      </Section>
    </>
  )
}

/* ------------------------------ 地板 ------------------------------ */

function FloorProps() {
  const floor = useLayout((s) => s.layout.floor)
  const update = useLayout((s) => s.updateFloor)
  const fit = useLayout((s) => s.fitFloorToWalls)
  return (
    <>
      <Section title="地板尺寸（公分）">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="寬 X" value={floor.size[0]} scale={100} min={50} unit="cm" onChange={(v) => update({ size: [v, floor.size[1]] }, 'floor-size')} />
          <NumberField label="深 Z" value={floor.size[1]} scale={100} min={50} unit="cm" onChange={(v) => update({ size: [floor.size[0], v] }, 'floor-size')} />
          <NumberField label="中心 X" value={floor.center[0]} scale={100} unit="cm" onChange={(v) => update({ center: [v, floor.center[1]] }, 'floor-c')} />
          <NumberField label="中心 Z" value={floor.center[1]} scale={100} unit="cm" onChange={(v) => update({ center: [floor.center[0], v] }, 'floor-c')} />
        </div>
        <Btn onClick={fit}>
          <Square size={14} /> 依牆壁自動貼合
        </Btn>
      </Section>
      <Section title="地板材質">
        <MaterialEditor brandKinds={['floor', 'tile']} spec={floor.material} onChange={(p) => update({ material: { ...floor.material, ...p } }, 'floor-mat')} />
      </Section>
    </>
  )
}

function ZoneProps({ id }: { id: string }) {
  const zone = useLayout((s) => s.layout.floorZones?.find((z) => z.id === id))
  const update = useLayout((s) => s.updateZone)
  if (!zone) return <Empty />
  return (
    <>
    <Section title={`${zone.name}尺寸位置（公分）`}>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="寬 X" value={zone.size[0]} scale={100} min={10} unit="cm" onChange={(v) => update(id, { size: [v, zone.size[1]] }, 'zone-size-' + id)} />
        <NumberField label="深 Z" value={zone.size[1]} scale={100} min={10} unit="cm" onChange={(v) => update(id, { size: [zone.size[0], v] }, 'zone-size-' + id)} />
        <NumberField label="中心 X" value={zone.center[0]} scale={100} unit="cm" onChange={(v) => update(id, { center: [v, zone.center[1]] }, 'zone-c-' + id)} />
        <NumberField label="中心 Z" value={zone.center[1]} scale={100} unit="cm" onChange={(v) => update(id, { center: [zone.center[0], v] }, 'zone-c-' + id)} />
      </div>
    </Section>
    <Section title={`${zone.name}材質（可選花磚 / 天藍磚）`}>
      <MaterialEditor brandKinds={['floor', 'tile']} spec={zone.material} onChange={(p) => update(id, { material: { ...zone.material, ...p } }, 'zone-mat-' + id)} />
    </Section>
    </>
  )
}

/* ------------------------------ 入口 ------------------------------ */

export function PropertiesPanel() {
  const sel = useUi((s) => s.selection)
  const furniture = useLayout((s) => (sel?.type === 'furniture' ? s.layout.furniture.find((f) => f.id === sel.id) : undefined))
  const wall = useLayout((s) => (sel?.type === 'wall' ? s.layout.walls.find((w) => w.id === sel.id) : undefined))
  if (!sel) return <Empty />
  if (sel.type === 'furniture' && furniture) return <FurnitureProps f={furniture} />
  if (sel.type === 'wall' && wall) return <WallProps w={wall} />
  if (sel.type === 'zone') return <ZoneProps id={sel.id} />
  if (sel.type === 'floor') return <FloorProps />
  return <Empty />
}

export function useSelectionTitle(): string {
  const sel = useUi((s) => s.selection)
  return useLayout((l) => {
    if (!sel) return '屬性'
    if (sel.type === 'zone') return l.layout.floorZones?.find((z) => z.id === sel.id)?.name ?? '地板分區'
    if (sel.type === 'floor') return '地板'
    if (sel.type === 'wall') return l.layout.walls.find((w) => w.id === sel.id)?.name ?? '牆壁'
    return l.layout.furniture.find((f) => f.id === sel.id)?.name ?? '家具'
  })
}
