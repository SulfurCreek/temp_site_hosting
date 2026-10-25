/**
 * 全專案共用型別。座標系：1 單位 = 1 公尺，Y 向上，地面為 XZ 平面，
 * +X = 東、-Z = 北（俯視圖上方）。詳見 CLAUDE.md。
 */

export type Vec2 = [number, number]
export type Vec3 = [number, number, number]

/** PBR 材質描述。顏色/粗糙度/金屬度必填，貼圖欄位選填。 */
export type Archetype = 'paint_eggshell' | 'egger_st9' | 'egger_st19' | 'laminate_wood' | 'matte_tile' | 'fabric_scratch'

export interface MaterialSpec {
  /** Hex 色碼，例如 "#e8e2d6"。有貼圖時作為色彩乘數（tint）。 */
  color: string
  /** 0 = 鏡面 … 1 = 完全粗糙。油漆：平光 0.95 / 蛋殼 0.6 / 亮光 0.25 */
  roughness: number
  /** 0 = 非金屬 … 1 = 金屬 */
  metalness: number
  /** 貼圖 URL（/inputs/... 或 data URL）。 */
  map?: string
  /** 每公尺重複幾次貼圖（Repeat Scale）。UV 以實際公尺計算，所以不同尺寸的物件紋理比例一致。 */
  repeat?: number
  /** 0–1，預設 1 */
  opacity?: number
  /** 建材物理基底：決定程序化微紋理（Normal/Roughness Map）與 clearcoat 等預設值 */
  archetype?: Archetype
  /** 0..1 透明塗層（耐磨層 / 漆膜） */
  clearcoat?: number
  clearcoatRoughness?: number
  /** 0..1 菲涅爾反射率（MeshPhysicalMaterial.reflectivity） */
  reflectivity?: number
  /** 微紋理法線強度（normalScale），0 = 關閉 */
  bumpScale?: number
  /**
   * Poly Haven 掃描貼圖組 slug（public/textures/<slug>/，由 scripts/fetch-textures.mjs 下載，見 src/lib/pbrTextures.ts）。
   * 載入後取代 map / 程序化微紋理；repeat = 1 為真實尺寸。省略時 egger_st9 / egger_st19 會自動套用預設組；false = 強制停用。
   */
  pbr?: string | false
}

export interface Opening {
  id: string
  type: 'door' | 'window'
  /** 開口中心距離牆「起點」的公尺數 */
  at: number
  width: number
  height: number
  /** 開口下緣離地高度（門 = 0） */
  sill: number
}

export interface Wall {
  id: string
  name: string
  /** 牆中心線起點 [x, z] */
  start: Vec2
  /** 牆中心線終點 [x, z] */
  end: Vec2
  height: number
  thickness: number
  /** 外牆才會參與「智慧破牆」 */
  exterior: boolean
  material: MaterialSpec
  openings: Opening[]
  /** 'railing' = 直立柵欄欄杆（下有矮牆），material = 框架色；預設實心牆 */
  style?: 'solid' | 'railing'
}

/** 地板分區（疊在主地板上方，例如玄關落塵區磁磚、浴室、陽台） */
export interface FloorZone {
  id: string
  name: string
  center: Vec2
  size: Vec2
  material: MaterialSpec
}

export interface Floor {
  /** 地板中心 [x, z] */
  center: Vec2
  /** [寬(X), 深(Z)] */
  size: Vec2
  material: MaterialSpec
}

/** 平面施工圖描圖層 */
export interface BlueprintLayer {
  id: string
  name: string
  url: string
}

export interface Blueprint {
  url: string
  /** 多圖層施工圖（平面/插座/燈具/開關…）。各圖已預先對位成同一座標框，共用 widthMeters/offset。 */
  layers?: BlueprintLayer[]
  /** 目前顯示的圖層 id；有 layers 時以它為準，url 僅作後備 */
  layerId?: string
  name?: string
  /** 圖片「實際寬度」（公尺）。高度由圖片長寬比推算。 */
  widthMeters: number
  /** 0–1 */
  opacity: number
  /** 圖片中心 [x, z] */
  offset: Vec2
  /** 度，繞 Y 軸 */
  rotation: number
  visible: boolean
  /** under = 位於地板下方（地板會自動半透明）；overlay = 疊在地板上方 */
  placement: 'under' | 'overlay'
}

export interface ReferenceImage {
  id: string
  name: string
  url: string
}

export type FurnitureMode = 'glb' | 'parametric' | 'billboard'
export type FaceName = 'front' | 'back' | 'left' | 'right' | 'top'
export type ParametricKind = 'box' | 'table' | 'sofa' | 'cabinet' | 'chair' | 'bed' | 'rug' | 'toilet' | 'sink' | 'hob' | 'roundtable' | 'shelf' | 'modsofa'

/** 把商品照貼在家具指定表面（模式 B） */
export interface Decal {
  face: FaceName
  url: string
  /** cover = 填滿裁切；contain = 完整顯示；stretch = 拉伸 */
  fit?: 'cover' | 'contain' | 'stretch'
}

export interface CatalogItem {
  id: string
  name: string
  category: 'living' | 'dining' | 'bedroom' | 'storage' | 'decor' | 'custom'
  mode: FurnitureMode
  /** 預設尺寸 [寬X, 高Y, 深Z]，公尺 */
  size: Vec3
  /** 目錄縮圖（選填） */
  thumbnail?: string
  /** 施工圖規格備註（內部層板、預留尺寸…），顯示在屬性面板 */
  notes?: string[]
  /** 模式 A */
  glb?: { url: string; fit?: 'stretch' | 'contain' }
  /** 模式 B */
  parametric?: {
    kind: ParametricKind
    /** 櫃體門片數（cabinet）或座位數（sofa）等 */
    count?: number
    /** modsofa：並排的模組（寬度公尺，mat 指定用哪個材質槽，預設 main）。頭靠加在第一個模組上 */
    modules?: { w: number; mat?: 'main' | 'secondary' | 'accent' }[]
    /** modsofa：第一個模組頂部加圓柱頭靠（長度公尺） */
    headrest?: number
    /** cabinet：正面留一個開放壁龕（放電子衣櫥/家電），w/h 為開口寬高（公尺），上方自動加一片上櫃門 */
    niche?: { w: number; h: number }
    /** main = 主體；secondary = 次要（椅墊/桌腳…）；accent = 點綴（把手/抱枕…） */
    materials: { main: MaterialSpec; secondary?: MaterialSpec; accent?: MaterialSpec }
    decals?: Decal[]
  }
  /** 模式 C */
  billboard?: {
    image: string
    /** 立牌薄片的厚度，公尺 */
    thickness?: number
  }
}

export interface FurnitureInstance {
  id: string
  catalogId: string
  name: string
  /** 底部中心 [x, y, z]，y 為離地高度 */
  position: Vec3
  /** 度，繞 Y 軸 */
  rotationY: number
  /** [寬, 高, 深]，公尺 */
  size: Vec3
  /** 覆寫目錄材質（parametric 用） */
  materials?: { main?: MaterialSpec; secondary?: MaterialSpec; accent?: MaterialSpec }
  decals?: Decal[]
  /** billboard 專用：持續朝向鏡頭 */
  faceCamera?: boolean
  locked?: boolean
}

export interface Layout {
  version: 1
  /**
   * 預設格局修訂號。修改 defaultLayout.json 時請遞增，
   * 瀏覽器內舊版自動儲存（rev 較低）會被新版預設取代（可 Ctrl+Z 找回）。
   */
  rev?: number
  name: string
  floor: Floor
  floorZones?: FloorZone[]
  walls: Wall[]
  furniture: FurnitureInstance[]
  blueprint: Blueprint | null
  references: ReferenceImage[]
  /** 使用者在 UI 內新增的自訂商品（與 catalog.json 合併） */
  customCatalog: CatalogItem[]
}

export type Selection =
  | { type: 'wall'; id: string }
  | { type: 'floor' }
  | { type: 'zone'; id: string }
  | { type: 'furniture'; id: string }
  | null

export type Projection = 'ortho' | 'persp'
export type CutawayMode = 'lower' | 'ghost' | 'off'
export type ToolMode = 'drag' | 'move' | 'rotate'
export type ViewPreset = 'SE' | 'SW' | 'NE' | 'NW' | 'TOP'
export type ViewMode = 'isometric' | 'firstPerson'
export type EyeMode = 'stand' | 'sit' | 'robot'

/** 第一人稱立足點預設點與天花板外框（src/data/vantage.json） */
export interface VantageHotspot {
  id: string
  name: string
  pos: Vec2
  look: Vec2
  eye: EyeMode
  note?: string
  estimated?: boolean
}
export interface VantageData {
  floor: { center: Vec2; size: Vec2 }
  ceilingHeight: number
  ceiling: Vec2[]
  extraWalk?: { id: string; center: Vec2; size: Vec2 }[]
  hotspots: VantageHotspot[]
}

/** 水電 / 燈具標記點。座標 [x, z]，高度 h 皆為公尺。 */
export type MepKind = 'outlet' | 'dedicated' | 'weak' | 'switch' | 'water' | 'track' | 'ceiling' | 'fan' | 'downlight' | 'strip'
export interface MepItem {
  id: string
  kind: MepKind
  label: string
  /** 位置 [x, z] */
  at: Vec2
  /** 離地高度（插座/開關）或安裝高度（燈具） */
  h: number
  /** 牆面朝向（從牆面指向室內的方向）：N=朝北(-Z) S=朝南(+Z) E=朝東(+X) W=朝西(-X)；天花板燈具省略 */
  face?: 'N' | 'S' | 'E' | 'W'
  /** 軌道燈/燈條：長度與方向；吸頂燈：直徑 */
  length?: number
  dir?: 'x' | 'z'
  heads?: number
  diameter?: number
  /** 圖面來源與是否為估計值 */
  src?: string
  assumed?: boolean
}

/** 材質庫（建材型號 → PBR 設定） */
export interface MaterialLibItem {
  id: string
  name: string
  brand?: string
  code?: string
  note?: string
  spec: MaterialSpec
}

/** 品牌建材字典項目（src/data/brandMaterials.json） */
export interface BrandMaterial {
  id: string
  brand: string
  /** 型號 / 色號 */
  code: string
  name: string
  /** 'paint' 牆漆 | 'board' 系統櫃板材 | 'floor' 地板 | 'tile' 磁磚 | 'fabric' 沙發布料 */
  kind: 'paint' | 'board' | 'floor' | 'tile' | 'fabric'
  archetype: Archetype
  hex: string
  roughness: number
  bumpScale: number
  clearcoat?: number
  clearcoatRoughness?: number
  reflectivity?: number
  metalness?: number
  /** albedo 貼圖（builtin:* 或 URL），沒有就是純色 */
  map?: string
  repeat?: number
  /** hex 可信度：official 官方給的 RGB/Hex；measured 專案內由圖面/照片取樣；reference 由官方 NCS/RAL 等參考色換算；estimate 目視估計 */
  hexConfidence: 'official' | 'measured' | 'reference' | 'estimate'
  /** hex 與特性的依據來源 */
  source: string
  /** 品牌說明（表面處理、用途） */
  description: string
}

export interface Settings {
  showMep: boolean
  projection: Projection
  cutaway: CutawayMode
  /** 吸附格距（公尺），0 = 關閉 */
  snap: number
  tool: ToolMode
  showGrid: boolean
  showHud: boolean
  /** 標準對色光：5500K 純白、無環境色偏，避免暖光造成色差誤判 */
  colorProof?: boolean
}
