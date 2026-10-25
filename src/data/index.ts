import brandJson from './brandMaterials.json'
import catalogJson from './catalog.json'
import layoutJson from './defaultLayout.json'
import materialsJson from './materials.json'
import mepJson from './mep.json'
import vantageJson from './vantage.json'
import type { BrandMaterial, CatalogItem, Layout, MaterialLibItem, MepItem, VantageData } from '../types'

export const BASE_CATALOG = catalogJson as unknown as CatalogItem[]
export const MATERIAL_LIB = materialsJson as unknown as MaterialLibItem[]
export const BRAND_MATERIALS = brandJson as unknown as BrandMaterial[]
export const MEP_ITEMS = mepJson as unknown as MepItem[]
export const VANTAGE = vantageJson as unknown as VantageData
export const DEFAULT_LAYOUT = layoutJson as unknown as Layout

export const CATEGORY_LABEL: Record<CatalogItem['category'], string> = {
  living: '客廳',
  dining: '餐廳',
  bedroom: '臥室',
  storage: '收納',
  decor: '佈置',
  custom: '自訂',
}
