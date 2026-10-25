import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

export function Section({
  title,
  icon,
  defaultOpen = true,
  children,
  right,
}: {
  title: string
  icon?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  right?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-white/10">
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-100 hover:bg-white/5"
        onClick={() => setOpen(!open)}
      >
        {icon}
        <span className="flex-1">{title}</span>
        {right}
        <ChevronDown size={16} className={cx('text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </section>
  )
}

/** 單一輸入框的欄位用 <label>（點標籤即聚焦）；含多個按鈕/輸入的群組用 <div>，避免點標籤誤觸第一個按鈕 */
export function Field({
  label,
  children,
  hint,
  single,
}: {
  label: string
  children: ReactNode
  hint?: string
  single?: boolean
}) {
  const Tag = single ? 'label' : 'div'
  return (
    <Tag className="block">
      <span className="mb-1 block text-xs text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-slate-500">{hint}</span>}
    </Tag>
  )
}

const inputCls =
  'w-full rounded-md border border-white/10 bg-slate-800/80 px-2 py-1.5 text-sm text-slate-100 outline-none focus:border-sky-400'

const fmt = (v: number, digits: number) => String(Math.round(v * 10 ** digits) / 10 ** digits)

/** 數值輸入。value 為內部單位（公尺），scale 為顯示倍率（公分 = 100）。 */
export function NumberField({
  label,
  value,
  onChange,
  scale = 1,
  step = 1,
  min,
  max,
  unit,
  digits = 1,
  hint,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  scale?: number
  step?: number
  min?: number
  max?: number
  unit?: string
  digits?: number
  hint?: string
}) {
  const [text, setText] = useState(fmt(value * scale, digits))
  const focused = useRef(false)
  useEffect(() => {
    if (!focused.current) setText(fmt(value * scale, digits))
  }, [value, scale, digits])
  return (
    <Field single label={label} hint={hint}>
      <div className="relative">
        <input
          className={cx(inputCls, unit && 'pr-8')}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={text}
          onFocus={() => (focused.current = true)}
          onBlur={() => {
            focused.current = false
            setText(fmt(value * scale, digits))
          }}
          onChange={(e) => {
            setText(e.target.value)
            let n = parseFloat(e.target.value)
            if (!Number.isFinite(n)) return
            if (min !== undefined) n = Math.max(min, n)
            if (max !== undefined) n = Math.min(max, n)
            onChange(n / scale)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {unit && <span className="pointer-events-none absolute right-2 top-1.5 text-xs text-slate-500">{unit}</span>}
      </div>
    </Field>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <Field single label={label}>
      <input className={inputCls} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  format?: (v: number) => string
}) {
  return (
    <Field single label={`${label}　${format ? format(value) : value}`}>
      <input
        className="w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </Field>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  small,
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
  small?: boolean
}) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-white/10 bg-slate-800/70 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'shrink-0 whitespace-nowrap rounded-md px-2 text-xs font-medium transition-colors',
            small ? 'py-1' : 'py-1.5',
            o.value === value ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:bg-white/10',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Btn({
  children,
  onClick,
  variant = 'default',
  className,
  title,
  disabled,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  className?: string
  title?: string
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
        variant === 'default' && 'border border-white/10 bg-slate-700/70 text-slate-100 hover:bg-slate-600/80',
        variant === 'primary' && 'bg-sky-500 text-white hover:bg-sky-400',
        variant === 'danger' && 'border border-red-400/30 bg-red-500/15 text-red-300 hover:bg-red-500/30',
        variant === 'ghost' && 'text-slate-300 hover:bg-white/10',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function IconBtn({
  children,
  onClick,
  title,
  active,
  disabled,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  title: string
  active?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-35',
        active ? 'bg-sky-500 text-white' : 'text-slate-200 hover:bg-white/10',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cx('flex items-center justify-between gap-3 text-sm text-slate-200', disabled ? 'opacity-40' : 'cursor-pointer')}>
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-sky-500' : 'bg-slate-600')}
      >
        <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
    </label>
  )
}
