import { Crop, Link2, Pipette, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { fileToDataUrl } from '../lib/image'
import { PAINT_FINISHES, finishOf } from '../lib/materials'
import { BUILTIN_TEXTURES, getBuiltinCanvas } from '../lib/proceduralTextures'
import { isHex } from '../lib/color'
import { MATERIAL_LIB } from '../data'
import { useUi } from '../store/uiStore'
import type { MaterialSpec } from '../types'
import { AssetGrid, CropModal, UploadButton } from './assets'
import { Btn, Field, Segmented, Slider, cx } from './controls'

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

export function MaterialEditor({
  spec,
  onChange,
  paint = false,
}: {
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
