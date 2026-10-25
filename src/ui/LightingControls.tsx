import { Lightbulb } from 'lucide-react'
import { LIGHT_SCENE_LIST } from '../lib/lightScenes'
import { useLayout } from '../store/layoutStore'
import type { FxQuality, LightScene } from '../types'
import { Segmented } from './controls'

/** 迴路開關情境：全開 / 僅開氛圍軌道燈 / 夜燈 / 白天自然光 */
export function LightSceneToggle() {
  const v = useLayout((s) => s.settings.lightScene ?? 'all')
  const proof = useLayout((s) => !!s.settings.colorProof)
  const set = useLayout((s) => s.setSettings)
  return (
    <div className="flex shrink-0 items-center gap-1.5" title={proof ? '標準對色光開啟中：燈光情境暫停' : undefined}>
      <Lightbulb size={15} className="shrink-0 text-amber-300" />
      <Segmented<LightScene>
        value={v}
        onChange={(lightScene) => set({ lightScene })}
        options={LIGHT_SCENE_LIST.map((x) => ({ value: x.id, label: x.label, title: x.title }))}
      />
    </div>
  )
}

/** 後期渲染品質：自動（手機降級）/ 高 / 中 / 低 */
export function FxQualityToggle() {
  const v = useLayout((s) => s.settings.fxQuality ?? 'auto')
  const set = useLayout((s) => s.setSettings)
  return (
    <Segmented<FxQuality>
      value={v}
      onChange={(fxQuality) => set({ fxQuality })}
      options={[
        { value: 'auto', label: '自動', title: '桌面高品質、手機自動降級' },
        { value: 'high', label: '高', title: 'AO + 地板反射 + 燈具陰影 + Bloom' },
        { value: 'medium', label: '中', title: '半解析度 AO + Bloom，無反射' },
        { value: 'low', label: '低', title: '無後期特效，僅 ACES 色調映射' },
      ]}
    />
  )
}
