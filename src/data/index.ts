import catalogJson from './catalog.json'
import layoutJson from './defaultLayout.json'
import type { CatalogItem, Layout } from '../types'

export const BASE_CATALOG = catalogJson as unknown as CatalogItem[]
export const DEFAULT_LAYOUT = layoutJson as unknown as Layout

export const CATEGORY_LABEL: Record<CatalogItem['category'], string> = {
  living: '客廳',
  dining: '餐廳',
  bedroom: '臥室',
  storage: '收納',
  decor: '佈置',
  custom: '自訂',
}
