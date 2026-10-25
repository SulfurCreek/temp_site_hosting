import { Crop, Lightbulb, Link2, Pipette, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { fileToDataUrl } from '../lib/image'
import { PAINT_FINISHES, finishOf } from '../lib/materials'
import { BUILTIN_TEXTURES, getBuiltinCanvas } from '../lib/proceduralTextures'
import { isHex } from '../lib/color'
import { BRAND_MATERIALS, MATERIAL_LIB } from '../data'
import { ARCHETYPE_LIST, ARCHETYPES, archetypePatch } from '../lib/archetypes'
import { useLayout } from '../store/layoutStore'
import { useUi } from '../store/uiStore'
import type { BrandMaterial, MaterialSpec } from '../types'
import { AssetGrid, CropModal, UploadButton } from './assets'
import { Btn, Field, Segmented, Slider, Toggle, cx } from './controls'

function BuiltinThumb({ id, label, active, onClick }: { id: string; label: string; active: boolean; onClick: () => void }) {
  const url = useMemo(() => getBuiltinCanvas(id)?.toDataURL('image/jpeg', 0.6), [id])
  return (
    <button
      title={label}
      onClick={onClick}
      className={cx(
        'overflow-hidden rounded-md border text-[10px] text-slate-300',
        active ? 'border-sky-400 ring-1 ring-sky-400' : 'border-white/10 hover:border-white/30',
      )}
    >
      <img src={url} alt={label} className="aspect-square w-full object-cover" draggable={false} />
      <div className="truncate bg-slate-800 px-1 py-0.5">{label}</div>
    </button>
  )
}

const CONF_LABEL: Record<BrandMaterial['hexConfidence'], string> = {
  official: '官方色值',
  measured: '專案實測',
  reference: '官方參考色換算',
  estimate: '估計值',
}

/** 把品牌建材字典項目轉成 MaterialSpec 補丁（未指定的物理欄位明確清空，避免殘留舊材質） */
export function brandPatch(b: BrandMaterial): Partial<MaterialSpec> {
  const a = ARCHETYPES[b.archetype]
  return {
    archetype: b.archetype,
    color: b.map ? '#ffffff' : b.hex.toLowerCase(),
    roughness: b.roughness,
    metalness: b.metalness ?? a.metalness,
    clearcoat: b.clearcoat ?? a.clearcoat,
    clearcoatRoughness: b.clearcoatRoughness ?? a.clearcoatRoughness,
    reflectivity: b.reflectivity ?? a.reflectivity,
    bumpScale: b.bumpScale,
    map: b.map,
    repeat: b.map ? (b.repeat ?? 1) : undefined,
    opacity: undefined,
  }
}

function BrandSwatchPicker({ kinds, onPick }: { kinds?: BrandMaterial['kind'][]; onPick: (b: BrandMaterial) => void }) {
  const list = BRAND_MATERIALS.filter((b) => !kinds || kinds.includes(b.kind))
  const [sel, setSel] = useState<string | null>(null)
  const cur = list.find((b) => b.id === sel)
  const colorProof = useLayout((s) => !!s.settings.colorProof)
  const setSettings = useLayout((s) => s.setSettings)
  return (
    <div className="space-y-2 rounded-md border border-white/10 p-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-200">品牌色卡 Brand Swatch</span>
        <span className="text-[10px] text-slate-500">{list.length} 款</span>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {list.map((b) => (
          <button
            key={b.id}
            title={`${b.brand} ${b.code}`}
            onClick={() => {
              setSel(b.id)
              onPick(b)
            }}
            className={cx(
              'aspect-square rounded-md border',
              sel === b.id ? 'border-sky-400 ring-1 ring-sky-400' : 'border-white/15 hover:border-white/40',
            )}
            style={{ background: b.hex }}
          />
        ))}
      </div>
      {cur && (
        <div className="space-y-0.5 rounded bg-slate-800/70 p-2 text-[11px] leading-relaxed text-slate-300">
          <div className="font-semibold text-slate-100">
            {cur.brand} {cur.code}
          </div>
          <div>
            {cur.hex.toUpperCase()}・{ARCHETYPES[cur.archetype].label}・R {cur.roughness}
          </div>
          <div className={cur.hexConfidence === 'estimate' ? 'text-amber-300' : 'text-emerald-300'}>色值：{CONF_LABEL[cur.hexConfidence]}</div>
          <div className="text-slate-400">{cur.description}</div>
          <div className="break-all text-[10px] text-slate-500">依據：{cur.source}</div>
        </div>
      )}
      <Toggle label="💡 標準對色光（5500K 純白、無環境色偏）" checked={colorProof} onChange={(v) => setSettings({ colorProof: v })} />
      <p className="flex items-start gap-1 text-[10px] text-slate-500">
        <Lightbulb size={11} className="mt-0.5 shrink-0" />
        開啟後場景改用中性白光，避免暖黃室內光造成色差誤判；螢幕色值仍與實體色卡有差，請以樣板為準。
      </p>
    </div>
  )
}

export function MaterialEditor({
  spec,
  onChange,
  paint = false,
  brandKinds,
}: {
  /** 品牌色卡要顯示哪些類型；不給 = 全部 */
  brandKinds?: BrandMaterial['kind'][]
  spec: MaterialSpec
  onChange: (patch: Partial<MaterialSpec>) => void
  /** 牆面油漆模式：顯示 平光/蛋殼光/亮光 */
  paint?: boolean
}) {
  const picked = useUi((s) => s.pickedColor)
  const [hex, setHex] = useState(spec.color)
  const [url, setUrl] = useState('')
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [folder, setFolder] = useState<'references' | 'products'>('references')
  const cropInput = useRef<HTMLInputElement>(null)
  const lastColor = useRef(spec.color)
  if (lastColor.current !== spec.color) {
    lastColor.current = spec.color
    if (hex !== spec.color) setHex(spec.color)
  }

  const setColor = (c: string) => {
    setHex(c)
    if (isHex(c)) onChange({ color: c.toLowerCase() })
  }

  return (
    <div className="space-y-3">
      <BrandSwatchPicker kinds={brandKinds} onPick={(b) => onChange(brandPatch(b))} />
      <Field label="建材物理基底 Archetype">
        <select
          value={spec.archetype ?? ''}
          onChange={(e) => {
            const v = e.target.value as keyof typeof ARCHETYPES | ''
            onChange(v ? archetypePatch(v) : { archetype: undefined, clearcoat: undefined, clearcoatRoughness: undefined, reflectivity: undefined, bumpScale: undefined })
          }}
          className="w-full rounded-md border border-white/10 bg-slate-800/80 px-2 py-1.5 text-sm text-slate-100"
        >
          <option value="">無（一般 PBR）</option>
          {ARCHETYPE_LIST.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </Field>
      {spec.archetype && (
        <Slider
          label="表面顆粒 / 壓紋強度 Bump"
          value={spec.bumpScale ?? ARCHETYPES[spec.archetype].bumpScale}
          min={0}
          max={2}
          step={0.05}
          onChange={(v) => onChange({ bumpScale: v })}
        />
      )}
      <Field label="材質庫（建材型號）">
        <select
          value=""
          onChange={(e) => {
            const m = MATERIAL_LIB.find((x) => x.id === e.target.value)
            if (m) onChange({ opacity: undefined, map: undefined, ...m.spec })
          }}
          className="w-full rounded-md border border-white/10 bg-slate-800/80 px-2 py-1.5 text-sm text-slate-100"
        >
          <option value="">選擇型號套用…</option>
          {MATERIAL_LIB.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="顏色（Hex）">
        <div className="flex gap-2">
          <input
            type="color"
            value={isHex(spec.color) ? spec.color : '#ffffff'}
            onChange={(e) => setColor(e.target.value)}
            className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-white/10 bg-transparent p-0.5"
          />
          <input
            value={hex}
            onChange={(e) => setColor(e.target.value)}
            maxLength={7}
            className="w-full rounded-md border border-white/10 bg-slate-800/80 px-2 py-1.5 font-mono text-sm uppercase text-slate-100 outline-none focus:border-sky-400"
          />
          {picked && (
            <button
              title={`套用參考圖取色 ${picked}`}
              onClick={() => setColor(picked)}
              className="flex shrink-0 items-center gap-1 rounded-md border border-white/10 px-2 text-xs text-slate-200 hover:bg-white/10"
            >
              <Pipette size={14} />
              <span className="h-4 w-4 rounded-sm border border-white/30" style={{ background: picked }} />
            </button>
          )}
        </div>
      </Field>

      {paint && (
        <Field label="漆面">
          <Segmented
            value={finishOf(spec.roughness) ?? 'custom'}
            options={PAINT_FINISHES.map((f) => ({ value: f.id as string, label: f.label }))}
            onChange={(id) => onChange({ roughness: PAINT_FINISHES.find((f) => f.id === id)!.roughness })}
          />
        </Field>
      )}
      <Slider label="粗糙度 Roughness" value={spec.roughness} min={0} max={1} step={0.01} onChange={(v) => onChange({ roughness: v })} />
      <Slider label="金屬度 Metalness" value={spec.metalness} min={0} max={1} step={0.01} onChange={(v) => onChange({ metalness: v })} />

      <div className="space-y-2 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">貼圖 / 貼皮</span>
          {spec.map && (
            <Btn variant="ghost" onClick={() => onChange({ map: undefined })}>
              <X size={12} /> 移除貼圖
            </Btn>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {BUILTIN_TEXTURES.map((t) => (
            <BuiltinThumb key={t.id} id={t.id} label={t.label} active={spec.map === t.id} onClick={() => onChange({ map: t.id, repeat: spec.repeat ?? 1 })} />
          ))}
        </div>
        {spec.map && !spec.map.startsWith('builtin:') && (
          <div className="flex items-center gap-2 rounded-md bg-slate-800/70 p-1.5">
            <img src={spec.map} alt="" className="h-10 w-10 rounded object-cover" />
            <span className="truncate text-[11px] text-slate-400">{spec.map.startsWith('data:') ? '（已上傳 / 裁切的圖片）' : spec.map}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <UploadButton label="上傳貼圖" maxSize={1024} onUrl={(u) => onChange({ map: u, repeat: spec.repeat ?? 1 })} />
          <input
            ref={cropInput}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) setCropSrc(await fileToDataUrl(f, 2400))
            }}
          />
          <Btn onClick={() => cropInput.current?.click()} title="選一張實景照片，框選區域後當作材質">
            <Crop size={14} /> 實景照裁切
          </Btn>
        </div>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="貼圖 URL（https://… 或 /inputs/…）"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-400"
          />
          <Btn
            onClick={() => {
              if (url.trim()) onChange({ map: url.trim(), repeat: spec.repeat ?? 1 })
            }}
          >
            <Link2 size={14} /> 套用
          </Btn>
        </div>
        <details className="rounded-md border border-white/10 p-2">
          <summary className="cursor-pointer text-xs text-slate-400">從 public/inputs 資料夾選取</summary>
          <div className="mt-2 space-y-2">
            <Segmented
              small
              value={folder}
              onChange={setFolder}
              options={[
                { value: 'references', label: 'references' },
                { value: 'products', label: 'products' },
              ]}
            />
            <AssetGrid kind={folder} activeUrl={spec.map} onPick={(e) => onChange({ map: e.url, repeat: spec.repeat ?? 1 })} />
          </div>
        </details>
        {spec.map && (
          <Slider
            label="重複縮放 Repeat Scale"
            value={spec.repeat ?? 1}
            min={0.1}
            max={8}
            step={0.05}
            onChange={(v) => onChange({ repeat: v })}
            format={(v) => `${v.toFixed(2)} 片/公尺`}
          />
        )}
      </div>
      {cropSrc && (
        <CropModal
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onDone={(u) => {
            onChange({ map: u, repeat: spec.repeat ?? 1 })
            setCropSrc(null)
          }}
        />
      )}
    </div>
  )
}
