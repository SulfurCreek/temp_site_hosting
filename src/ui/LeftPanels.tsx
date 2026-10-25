import {
  Archive,
  Armchair,
  Bed,
  Box,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Package,
  Plus,
  Ruler,
  Sofa,
  Table,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { uid } from '../lib/ids'
import { imageAspect } from '../lib/image'
import { addFromCatalog } from '../store/actions'
import { CATEGORY_LABEL } from '../data'
import { useCatalog, useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import type { CatalogItem, ParametricKind } from '../types'
import { AssetGrid, UploadButton } from './assets'
import { Btn, Field, NumberField, Section, Segmented, Slider, TextField, Toggle, cx } from './controls'
import { refFromEntry, useIsMobile } from './hooks'

/* ------------------------------ 家具目錄 ------------------------------ */

function ItemIcon({ item }: { item: CatalogItem }) {
  const p = 22
  if (item.mode === 'billboard') return <ImageIcon size={p} />
  if (item.mode === 'glb') return <Package size={p} />
  switch (item.parametric?.kind) {
    case 'modsofa':
    case 'sofa':
      return item.parametric.count === 1 ? <Armchair size={p} /> : <Sofa size={p} />
    case 'bed':
      return <Bed size={p} />
    case 'table':
      return <Table size={p} />
    case 'cabinet':
      return <Archive size={p} />
    case 'chair':
      return <Armchair size={p} />
    default:
      return <Box size={p} />
  }
}

const MODE_BADGE = { glb: 'GLB', parametric: 'PBR', billboard: '立牌' } as const

export function CatalogPanel() {
  const catalog = useCatalog()
  const [cat, setCat] = useState<CatalogItem['category'] | 'all'>('all')
  const [custom, setCustom] = useState(false)
  const mobile = useIsMobile()
  const cats = ['all', ...Array.from(new Set(catalog.map((c) => c.category)))] as (CatalogItem['category'] | 'all')[]
  const items = catalog.filter((c) => cat === 'all' || c.category === cat)

  const add = (item: CatalogItem) => {
    addFromCatalog(item)
    useUi.getState().showToast(`已新增「${item.name}」到畫面中央`)
    if (mobile) useUi.getState().openSheet('props', 'peek')
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap gap-1.5">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cx(
              'rounded-full px-2.5 py-1 text-xs',
              cat === c ? 'bg-sky-500 text-white' : 'bg-slate-700/70 text-slate-300 hover:bg-slate-600',
            )}
          >
            {c === 'all' ? '全部' : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-2 lg:gap-2">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => add(it)}
            className="group relative flex flex-col items-start gap-1.5 rounded-lg border border-white/10 bg-slate-800/70 p-2.5 text-left transition hover:border-sky-400/60 hover:bg-slate-700/70 active:scale-[0.98]"
          >
            <span className="flex h-10 w-full items-center justify-center rounded-md bg-slate-900/60 text-sky-300">
              {it.thumbnail ? <img src={it.thumbnail} alt="" className="h-full object-contain" /> : <ItemIcon item={it} />}
            </span>
            <span className="text-xs font-medium text-slate-100">{it.name}</span>
            <span className="text-[10px] text-slate-400">
              {Math.round(it.size[0] * 100)}×{Math.round(it.size[2] * 100)}×{Math.round(it.size[1] * 100)} cm
            </span>
            <span className="absolute right-1.5 top-1.5 rounded bg-slate-900/70 px-1 text-[9px] text-slate-400">{MODE_BADGE[it.mode]}</span>
            <Plus size={14} className="absolute bottom-2 right-2 text-slate-500 group-hover:text-sky-300" />
          </button>
        ))}
      </div>
      <Btn className="w-full" onClick={() => setCustom(true)}>
        <Plus size={14} /> 自訂商品（照片 / .glb / 積木）
      </Btn>
      {custom && <CustomProductModal onClose={() => setCustom(false)} />}
    </div>
  )
}

function CustomProductModal({ onClose }: { onClose: () => void }) {
  const addCustom = useLayout((s) => s.addCustomCatalog)
  const [mode, setMode] = useState<CatalogItem['mode']>('billboard')
  const [name, setName] = useState('')
  const [image, setImage] = useState('')
  const [glb, setGlb] = useState('')
  const [kind, setKind] = useState<ParametricKind>('box')
  const [color, setColor] = useState('#cbd5e1')
  const [w, setW] = useState(0.6)
  const [h, setH] = useState(1)
  const [d, setD] = useState(0.4)
  const [aspect, setAspect] = useState(1)

  const pickImage = async (url: string, label?: string) => {
    setImage(url)
    if (!name && label) setName(label)
    try {
      const a = await imageAspect(url)
      setAspect(a)
      setW(Math.round(h * a * 100) / 100) // 依照片長寬比 + 真實高度推算寬度
    } catch {
      /* ignore */
    }
  }

  const ready = mode === 'billboard' ? !!image : mode === 'glb' ? !!glb : true

  const create = () => {
    const base = { id: uid('custom'), name: name.trim() || '自訂商品', category: 'custom' as const, mode, size: [w, h, d] as [number, number, number] }
    const item: CatalogItem =
      mode === 'billboard'
        ? { ...base, billboard: { image, thickness: 0.03 } }
        : mode === 'glb'
          ? { ...base, glb: { url: glb, fit: 'stretch' } }
          : { ...base, parametric: { kind, count: 2, materials: { main: { color, roughness: 0.7, metalness: 0 } } } }
    addCustom(item)
    addFromCatalog(item)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onPointerDown={(e) => e.stopPropagation()}>
      <div className="glass scroll-thin max-h-[92vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-2xl p-4 text-slate-100 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">自訂商品</h3>
          <Btn variant="ghost" onClick={onClose}>
            關閉
          </Btn>
        </div>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'billboard', label: '商品照立牌' },
            { value: 'glb', label: '.glb 模型' },
            { value: 'parametric', label: 'PBR 積木' },
          ]}
        />
        <TextField label="名稱" value={name} onChange={setName} placeholder="例如：奶油白單椅" />

        {mode === 'billboard' && (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-slate-400">
              選一張商品去背照（PNG 透明背景最佳）或 AI 生成的 3D 家具圖。輸入真實高度後，寬度會依照片比例自動推算，並建立有長寬高碰撞框的立體卡片。
            </p>
            <div className="flex items-center gap-2">
              <UploadButton maxSize={1280} onUrl={(u, f) => pickImage(u, f.name.replace(/\.[^.]+$/, ''))} />
              {image && <img src={image} alt="" className="h-12 rounded border border-white/10 bg-slate-800 object-contain" />}
            </div>
            <AssetGrid kind="products" onPick={(e) => pickImage(e.url, e.name)} />
          </div>
        )}
        {mode === 'glb' && (
          <div className="space-y-2">
            <p className="text-[11px] leading-relaxed text-slate-400">
              建議把 .glb 放進 <code className="text-slate-200">public/inputs/products/</code> 後從下方選取（重新整理後仍有效）。直接上傳的檔案僅在本次瀏覽有效。
            </p>
            <AssetGrid kind="products" models onPick={(e) => e.kind === 'model' && (setGlb(e.url), !name && setName(e.name))} activeUrl={glb} />
            <UploadButton
              label="上傳 .glb（暫時）"
              accept=".glb,.gltf,model/gltf-binary"
              onFile={(f) => {
                setGlb(URL.createObjectURL(f))
                if (!name) setName(f.name.replace(/\.[^.]+$/, ''))
                useUi.getState().showToast('此 .glb 僅本次瀏覽有效，請放入 public/inputs/products/ 永久使用')
              }}
              icon={<Package size={14} />}
            />
            {glb && <p className="break-all text-[11px] text-slate-400">已選：{glb.startsWith('blob:') ? '(本機暫存檔)' : glb}</p>}
          </div>
        )}
        {mode === 'parametric' && (
          <div className="space-y-2">
            <Field label="類型">
              <select value={kind} onChange={(e) => setKind(e.target.value as ParametricKind)} className="w-full rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-sm">
                <option value="box">方塊</option>
                <option value="table">桌子</option>
                <option value="sofa">沙發</option>
                <option value="cabinet">櫃體</option>
                <option value="chair">椅子</option>
                <option value="bed">床</option>
                <option value="rug">地毯</option>
              </select>
            </Field>
            <Field label="主色">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-white/10 bg-transparent p-0.5" />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <NumberField
            label="寬"
            value={w}
            scale={100}
            unit="cm"
            min={1}
            onChange={(v) => {
              setW(v)
              if (mode === 'billboard') setH(Math.round((v / aspect) * 100) / 100)
            }}
          />
          <NumberField
            label="高"
            value={h}
            scale={100}
            unit="cm"
            min={1}
            onChange={(v) => {
              setH(v)
              if (mode === 'billboard') setW(Math.round(v * aspect * 100) / 100)
            }}
          />
          <NumberField label="深" value={d} scale={100} unit="cm" min={1} onChange={setD} />
        </div>
        <Btn variant="primary" className="w-full py-2" disabled={!ready} onClick={create}>
          加入目錄並放入場景
        </Btn>
      </div>
    </div>
  )
}

/* ------------------------------ 施工圖底圖 ------------------------------ */

export function BlueprintPanel() {
  const bp = useLayout((s) => s.layout.blueprint)
  const set = useLayout((s) => s.setBlueprint)
  const calib = useUi((s) => s.calib)
  const [real, setReal] = useState('')
  const showGrid = useLayout((s) => s.settings.showGrid)

  const [a, b] = calib.points
  const measured = a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : 0

  useEffect(() => {
    if (!calib.active) setReal('')
  }, [calib.active])

  const applyCalib = () => {
    const r = parseFloat(real)
    if (!bp || !a || !b || !(r > 0) || measured < 0.001) return
    const s = r / measured
    // 以 A 點為基準縮放，A 點在畫面上的位置不動
    set({
      widthMeters: bp.widthMeters * s,
      offset: [a[0] + (bp.offset[0] - a[0]) * s, a[1] + (bp.offset[1] - a[1]) * s],
    })
    useUi.getState().endCalib()
    useUi.getState().showToast(`比例已校準：圖片寬度 ${(bp.widthMeters * s).toFixed(2)} m`)
  }

  return (
    <div className="space-y-3 p-4">
      <p className="text-[11px] leading-relaxed text-slate-400">
        施工圖會鋪在 3D 地板下方（地板自動變半透明）。輸入圖片「實際寬度」讓比例正確，牆壁與家具即可對照施工圖精準擺放。
      </p>
      <AssetGrid
        kind="floorplans"
        activeUrl={bp?.url}
        onPick={(e) => set({ url: e.url, name: e.name, visible: true })}
        empty="public/inputs/floorplans/ 內尚無檔案。放入平面施工圖（PNG/JPG/SVG）後重新整理。"
      />
      <UploadButton label="上傳平面施工圖" maxSize={2600} onUrl={(url, f) => set({ url, name: f.name, visible: true })} />

      {bp?.layers && bp.layers.length > 0 && (
        <Field label="施工圖圖層切換">
          <div className="grid grid-cols-2 gap-1.5">
            {bp.layers.map((l) => {
              const on = (bp.layerId ?? bp.layers![0].id) === l.id
              return (
                <button
                  key={l.id}
                  onClick={() => set({ layerId: l.id, visible: true })}
                  className={cx(
                    'rounded-md border px-2 py-1.5 text-xs font-medium',
                    on ? 'border-sky-400 bg-sky-500 text-white' : 'border-white/10 bg-slate-800/70 text-slate-200 hover:bg-slate-700',
                  )}
                >
                  {l.name}
                </button>
              )
            })}
          </div>
        </Field>
      )}
      {bp ? (
        <div className="space-y-3 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs text-slate-300">{bp.name ?? '施工圖'}</span>
            <div className="flex gap-1.5">
              <Btn onClick={() => set({ visible: !bp.visible })}>
                {bp.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                {bp.visible ? '顯示' : '隱藏'}
              </Btn>
              <Btn variant="danger" onClick={() => set(null)}>
                <Trash2 size={14} />
              </Btn>
            </div>
          </div>
          <NumberField
            label="圖片實際寬度（比例尺）"
            value={bp.widthMeters}
            unit="m"
            step={0.1}
            digits={3}
            min={0.5}
            hint="量測施工圖上整張圖的真實寬度（公尺）。不確定時可用下方兩點校準。"
            onChange={(v) => set({ widthMeters: v }, 'bp-w')}
          />
          <Slider label="透明度" value={bp.opacity} min={0.05} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ opacity: v }, 'bp-o')} />
          <Field label="圖層位置">
            <Segmented
              value={bp.placement}
              onChange={(v) => set({ placement: v })}
              options={[
                { value: 'under', label: '地板下方' },
                { value: 'overlay', label: '疊在地板上' },
              ]}
            />
          </Field>
          <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-2 lg:gap-2">
            <NumberField label="偏移 X" value={bp.offset[0]} scale={100} unit="cm" onChange={(v) => set({ offset: [v, bp.offset[1]] }, 'bp-off')} />
            <NumberField label="偏移 Z" value={bp.offset[1]} scale={100} unit="cm" onChange={(v) => set({ offset: [bp.offset[0], v] }, 'bp-off')} />
          </div>
          <Slider label="旋轉" value={bp.rotation} min={-180} max={180} step={0.5} format={(v) => `${v}°`} onChange={(v) => set({ rotation: v }, 'bp-r')} />

          <div className="space-y-2 rounded-lg border border-white/10 bg-slate-800/50 p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
              <Ruler size={14} /> 兩點比例尺校準
            </div>
            {!calib.active ? (
              <>
                <p className="text-[11px] leading-relaxed text-slate-400">在施工圖上點選兩個已知真實距離的點（例如一道牆的兩端），再輸入實際距離。</p>
                <Btn onClick={() => useUi.getState().startCalib()}>開始量測</Btn>
              </>
            ) : (
              <>
                <p className="text-[11px] text-amber-300">
                  {calib.points.length < 2 ? `請在 3D 畫面點選第 ${calib.points.length + 1} 個點（共 2 點）` : `目前量得 ${(measured * 100).toFixed(1)} cm`}
                </p>
                {calib.points.length === 2 && (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <NumberField label="這段實際距離" value={parseFloat(real) || 0} unit="m" step={0.01} digits={3} onChange={(v) => setReal(String(v))} />
                    </div>
                    <Btn variant="primary" onClick={applyCalib}>
                      套用
                    </Btn>
                  </div>
                )}
                <Btn variant="ghost" onClick={() => useUi.getState().endCalib()}>
                  取消
                </Btn>
              </>
            )}
          </div>
          <Toggle label="顯示 0.5 m 格線" checked={showGrid} onChange={(v) => useLayout.getState().setSettings({ showGrid: v })} />
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------ 實景 / 靈感參考圖庫 ------------------------------ */

export function ReferencePanel() {
  const refs = useLayout((s) => s.layout.references)
  const add = useLayout((s) => s.addReference)
  const remove = useLayout((s) => s.removeReference)
  const pip = useUi((s) => s.pip)
  const setPip = useUi((s) => s.setPip)
  const mobile = useIsMobile()

  const open = (id: string) => {
    setPip({ open: true, refId: id })
    if (mobile) useUi.getState().setSheet('closed')
  }

  return (
    <div className="space-y-3 p-4">
      <p className="text-[11px] leading-relaxed text-slate-400">
        現場照片或 AI 生成的 3D 渲染圖。點選後開啟「對照視窗」，可懸浮、半透明疊加或左右分割，並用吸管取色套用到牆面 / 家具。
      </p>
      <div className="grid grid-cols-3 gap-2">
        {refs.map((r) => (
          <div key={r.id} className={cx('group relative overflow-hidden rounded-md border bg-slate-800', pip.refId === r.id && pip.open ? 'border-sky-400' : 'border-white/10')}>
            <button className="block w-full" onClick={() => open(r.id)} title={r.name}>
              <img src={r.url} alt={r.name} className="aspect-square w-full object-cover" draggable={false} />
              <div className="truncate px-1.5 py-1 text-left text-[10px] text-slate-300">{r.name}</div>
            </button>
            <button
              className="absolute right-1 top-1 hidden rounded bg-slate-900/80 p-1 text-slate-300 hover:text-red-300 group-hover:block"
              onClick={() => remove(r.id)}
              title="從圖庫移除"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
      <UploadButton label="上傳實景 / 靈感圖" maxSize={2200} onUrl={(url, f) => open(add({ name: f.name.replace(/\.[^.]+$/, ''), url }))} />
      <Section title="public/inputs/references/" defaultOpen>
        <AssetGrid
          kind="references"
          onPick={(e) => {
            const exists = refs.find((r) => r.url === e.url)
            const r = refFromEntry(e)
            open(exists ? exists.id : add({ name: r.name, url: r.url }))
          }}
        />
      </Section>
    </div>
  )
}
