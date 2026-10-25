# CLAUDE.md — 3D 室內裝潢與格局動態規劃系統

Vite + React 19 + TypeScript + Tailwind v4 + Three.js（`@react-three/fiber` / `drei`）+ zustand。
部署目標：**Cloudflare Workers（Static Assets）**。

## ⚠️ 最重要的規則：視覺輸入必須自動轉成資料

> **當使用者提供平面施工圖、實景照片或商品照片時，Claude 必須自動使用視覺能力讀取圖片，計算比例或提取色彩/材質特徵，並直接更新 `src/data/defaultLayout.json` 或 `src/data/catalog.json`。**
> 不要只回覆文字描述，也不要請使用者手動輸入數字——先讀圖、算出數值、改檔，再告訴使用者改了什麼、哪些是估計值。

> **使用者規則：輸入圖片上的手寫痕跡一律不要**——手寫只用來讀資訊，存進專案的底圖/參考圖都要移除（PDF 用 `pdftoppm -hide-annotations`，點陣圖局部修補或裁掉）。

**快速入口：`/update-room [檔案路徑...]`**（`.claude/commands/update-room.md`）會自動掃描輸入、依類型解析、做 Diff 式更新、跑 build 並回報；使用者丟新圖時優先用它的流程。

使用者通常會把圖片丟到 `public/inputs/` 下，或直接貼在對話裡。處理流程見下方〈視覺輸入處理手冊〉。
修改 `defaultLayout.json` 後**必須把 `rev` 加 1**（見〈資料檔注意事項〉），並執行 `npm run build` 確認型別與建置通過。

---

## 指令

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 開發伺服器（http://localhost:5173）。dev 時 `window.__layout` / `window.__ui` / `window.__r3f` 可在 console 檢查狀態 |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run build` | 型別檢查 + `vite build` → `dist/`（同時產生 `dist/inputs/manifest.json`） |
| `npm run deploy` | build 後 `wrangler deploy`（需 `wrangler login` 或 `CLOUDFLARE_API_TOKEN`） |
| `npm run cf:dev` | build 後以 `wrangler dev` 本機模擬 Workers 靜態資源 |

`wrangler.jsonc`：`assets.directory = ./dist`，`not_found_handling = single-page-application`，沒有 Worker 腳本。

---

## 座標系統（全專案一致）

- **1 單位 = 1 公尺**。所有 JSON 數值皆為公尺（UI 以公分顯示，僅在 UI 層 ×100）。
- 右手座標，**Y 向上**；地面是 **XZ 平面**，地板表面 `y = 0`。
- **+X = 東，−X = 西，+Z = 南，−Z = 北**。俯視圖（平面視角）上方 = 北。
- 世紀帝國視角：相機位於房間的 SE（東南）/ SW / NE / NW 角落，俯角 55°，預設 SE、**正交相機**。
- **旋轉**：`rotationY` 單位為**度**，繞 +Y，正值 = 從上往下看**逆時針**。
  家具在 `rotationY = 0` 時「正面」朝 **+Z（南）**；`180` → 朝北；`-90`（= 270）→ 朝西；`90` → 朝東。
- **家具原點 = 底部中心**：`position = [x, y, z]`，`y` 為離地高度（一般 0）；`size = [寬X, 高Y, 深Z]`（未旋轉時的軸向）。
- **牆以「中心線」定義**：`start` / `end` = `[x, z]`。牆體向兩側各延伸半個 `thickness`，兩端也各延伸半個牆厚以便轉角密合。
  → 若室內淨空角點是 `(±2.7, ±2.1)`、牆厚 0.12，則牆中心線在 `(±2.76, ±2.16)`。
- 牆的**門窗**以 `at`（開口**中心**距牆 `start` 的公尺數，沿中心線量）定位。
- 貼圖 UV 以公尺計算：`repeat` = **每公尺重複幾次**（不是總次數），所以同一貼圖在不同尺寸物件上比例一致。

---

## 專案結構

```
CLAUDE.md
.claude/commands/update-room.md  /update-room 斜線指令（視覺輸入 → 資料更新工作流）
wrangler.jsonc               Cloudflare Workers Static Assets 設定
vite.config.ts               含 inputs-manifest plugin（掃描 public/inputs/*）
public/
  inputs/
    floorplans/              平面施工圖（PNG/JPG/SVG）→ 3D 地板下方的描圖層
    references/              實景照片 / 其他 AI 生成的 3D 渲染圖 → 對照懸浮窗
    products/                商品去背照（PNG）、.glb 模型 → 家具載入器
    manifest.json            （自動產生，勿手改）
  legacy/quote-estimator.html  原本放在根目錄的舊頁面，已搬到這裡
src/
  data/
    defaultLayout.json       預設格局（第一次開啟 / 還原預設時載入）
    catalog.json             家具目錄
    index.ts                 以型別載入上面兩個 JSON
  types.ts                   所有 Schema 的 TypeScript 型別（JSON 欄位的權威定義）
  store/
    layoutStore.ts           zustand + persist（localStorage）。layout + settings、復原/重做、匯入驗證
    uiStore.ts               暫態 UI：選取、抽屜、PIP、比例尺校準、toast
    actions.ts               跨 store 的動作（匯出入、旋轉、刪除、套用取色…）
  lib/                       材質 hook、UV 幾何、程序化貼圖、色溫、影像工具、debounce 儲存
  scene/
    Scene.tsx                Canvas、陰影、組合所有場景元件
    CameraRig.tsx            正交/透視雙相機、OrbitControls、斜視 ⇄ 平面視角轉場（無四方位按鈕）
    Walls.tsx                牆（開口切塊）+ 智慧破牆
    Floor.tsx / Blueprint.tsx 地板、施工圖描圖層、兩點校準層
    Furniture.tsx            混合式家具載入器（GLB / 參數化 / 立牌）+ 直接拖拉
    Gizmo.tsx                TransformControls（位移軸/旋轉環）
    Lighting.tsx             色溫燈光 + `<Environment preset="apartment" />`
  ui/                        TopBar、LeftPanels、PropertiesPanel、Panels(抽屜/底部抽屜)、ReferenceViewer、Hud…
```

---

## Schema：`src/data/defaultLayout.json`

型別定義見 `src/types.ts`（`Layout`）。匯出/匯入的 `layout.json` 是同一個格式。

```jsonc
{
  "version": 1,                 // 固定 1
  "rev": 1,                     // 修改此檔就 +1（見〈資料檔注意事項〉）
  "name": "預設客廳 5.4 × 4.2 m",
  "floor": {
    "center": [0, 0],           // [x, z]
    "size": [5.4, 4.2],         // [寬 X, 深 Z]
    "material": MaterialSpec
  },
  "floorZones": [               // 選填：疊在主地板上的分區（玄關磁磚、浴室、陽台…）
    { "id": "z-foyer", "name": "玄關落塵區", "center": [-3.6, 2.1], "size": [1.9, 1.5], "material": MaterialSpec }
  ],
  "walls": [Wall, ...],
  "furniture": [FurnitureInstance, ...],
  "blueprint": Blueprint | null,
  "references": [{ "id": "ref-1", "name": "客廳實景", "url": "/inputs/references/living.jpg" }],
  "customCatalog": [CatalogItem, ...]   // 使用者在 UI 新增的自訂商品（通常為空）
}
```

### MaterialSpec
```jsonc
{
  "color": "#ece7df",     // Hex。有貼圖時是色彩乘數（要原色請用 #ffffff）
  "roughness": 0.95,      // 0..1。油漆：平光 0.95 / 蛋殼光 0.6 / 亮光 0.25
  "metalness": 0,         // 0..1
  "map": "builtin:oak",   // 選填。builtin:<oak|walnut|tile|concrete|fabric|marble> 或 URL（/inputs/... 、https://... 、data:）
  "repeat": 1,            // 選填。每公尺重複次數，預設 1（builtin 貼圖每張涵蓋 1 m）
  "opacity": 1            // 選填
}
```

### Wall
```jsonc
{
  "id": "wall-n", "name": "北牆",
  "start": [-2.76, -2.16], "end": [2.76, -2.16],   // 中心線，公尺
  "height": 2.6, "thickness": 0.12,
  "exterior": true,        // true 才參與智慧破牆（外牆）；隔間牆設 false
  "material": MaterialSpec,
  "openings": [
    { "id": "win-n1", "type": "window", "at": 4.4, "width": 2.0, "height": 1.3, "sill": 0.9 },
    { "id": "door-s1", "type": "door",  "at": 1.3, "width": 0.9, "height": 2.1, "sill": 0 }
  ]
}
```
外牆法線 = 與牆垂直、**背離 floor.center** 的方向（程式自動算，不需填寫）。
牆順序無限制，但建議順時針（北→東→南→西）。

### Blueprint（平面施工圖描圖層）
```jsonc
{
  "url": "/inputs/floorplans/plan.png",
  "layers": [                // 選填：多圖層（平面/插座/燈具/開關…），UI 左側「施工圖圖層切換」
    { "id": "plan", "name": "平面配置圖", "url": "/inputs/floorplans/hongzhu-1-plan.png" }
  ],
  "layerId": "plan",         // 目前顯示的圖層；各圖層必須「預先對位成同一座標框、同一像素尺寸」，共用下面的 widthMeters/offset
  "name": "plan",
  "widthMeters": 6.4,        // 整張「圖片」的實際寬度（公尺）。高度 = 寬 / 圖片長寬比
  "opacity": 0.55,           // 0..1
  "offset": [0, 0],          // 圖片中心在世界座標的 [x, z]
  "rotation": 0,             // 度，繞 Y（正值 = 俯視逆時針）
  "visible": true,
  "placement": "under"       // "under" 地板下方（地板自動半透明） | "overlay" 疊在地板上
}
```
圖片的「右」= +X（東），圖片的「上」= −Z（北）。

### FurnitureInstance
```jsonc
{
  "id": "f-sofa", "catalogId": "sofa-3seat", "name": "三人沙發",
  "position": [-0.9, 0, 1.5],       // 底部中心 [x, y(離地), z]
  "rotationY": 180,                 // 度
  "size": [2.2, 0.85, 0.95],        // [寬, 高, 深]，可與目錄不同（實例層覆寫）
  "materials": { "main": MaterialSpec, "secondary": MaterialSpec, "accent": MaterialSpec },  // 選填，覆寫目錄材質
  "decals": [{ "face": "top", "url": "/inputs/products/x.png", "fit": "cover" }],           // 選填，商品照貼面
  "faceCamera": false,              // 選填，僅 billboard
  "locked": false                   // 選填
}
```

---

## Schema：`src/data/catalog.json`

陣列，每項是 `CatalogItem`。**`mode` 決定載入方式**（混合式家具載入器）：

```jsonc
{
  "id": "sofa-3seat",            // 唯一；FurnitureInstance.catalogId 指向它
  "name": "三人沙發",
  "category": "living",          // living | dining | bedroom | storage | decor | custom
  "mode": "parametric",          // "glb" | "parametric" | "billboard"
  "size": [2.2, 0.85, 0.95],     // 預設 [寬X, 高Y, 深Z]，公尺
  "thumbnail": "/inputs/products/x.png",   // 選填

  // mode = "glb"  —— 模式 A：直接載入 .glb
  "glb": { "url": "/inputs/products/stool.glb", "fit": "stretch" },
  //   fit: "stretch"（預設，縮放到剛好等於 size，精準尺寸）| "contain"（等比縮放放進 size）
  //   載入時自動把模型底部中心移到原點，所以 .glb 原點在哪都可以。

  // mode = "parametric" —— 模式 B：參數化 PBR 積木（精準長寬高 + 材質）
  "parametric": {
    "kind": "sofa",              // box | table | sofa | cabinet | chair | bed | rug
    "count": 3,                  // sofa: 座位數(1=單椅)；cabinet: 門片數
    "niche": { "w": 0.68, "h": 2.165 },  // 選填，cabinet：正面開放壁龕（放電子衣櫥/家電），上方自動加上櫃門
    "materials": {
      "main": MaterialSpec,      // 主體（沙發本體/桌面/櫃門）
      "secondary": MaterialSpec, // 次要（椅腳/桌腳/櫃體/床框）
      "accent": MaterialSpec     // 點綴（抱枕/把手/床罩）
    },
    "decals": [{ "face": "front", "url": "...", "fit": "cover" }]   // 選填：把商品照貼在指定表面
  },
  //   decal.face: front | back | left | right | top；fit: cover | contain | stretch

  // mode = "billboard" —— 模式 C：2.5D 智慧立牌（只有一張商品照/AI 圖時先佔位）
  "billboard": { "image": "/inputs/products/plant.png", "thickness": 0.03 }
  //   產生「圖片卡片 + 真實 w×h×d 碰撞框（虛線）+ 地面佔地」。去背 PNG（alpha）效果最好。
}
```
各 `kind` 的幾何都以 `size` 參數化：改 `size` 會精準縮放各部件（椅腳粗細等有上限，不會被拉歪）。

### 其他資料檔
- `src/data/brandMaterials.json`：**品牌建材字典**（Dulux、EGGER、超耐磨、磁磚），每項有 `hex` `archetype` `roughness` `bumpScale` `hexConfidence` `source`；UI 屬性面板的「品牌色卡」使用。MaterialSpec 新增 `archetype`（paint_eggshell / egger_st9 / egger_st19 / laminate_wood / matte_tile）、`clearcoat` `clearcoatRoughness` `reflectivity` `bumpScale`，由 `src/lib/materials.ts` 以 MeshPhysicalMaterial + 程序化 Normal/Roughness 微紋理渲染。指定品牌型號的流程見 `/update-room`。
- `src/data/materials.json`：**材質庫**，`[{ id, name, brand?, code?, note?, spec: MaterialSpec }]`。建材型號（EGGER W1000 ST19、地磚、漆色…）註冊在這；UI 的「材質庫」下拉會套用 `spec`。新增型號時同時填 `code` 與 `note`（來源/估計）。
- `src/data/mep.json`：**水電/燈具標記**，`[MepItem]`（型別見 `types.ts`）。`kind`: outlet | dedicated | weak | switch | water | track | ceiling | fan | downlight | strip；`at:[x,z]`；`h`＝離地/安裝高度（公尺）；`face`＝牆面朝向（從牆指向室內：N 朝北 -Z、S 朝南 +Z、E 朝東、W 朝西；天花板燈具省略）；`assumed:true` 表示圖面未標、為推估值；`src`＝圖面來源頁。頂部工具列 **MEP** 開關控制顯示，點標記看資訊。
- `CatalogItem.notes?: string[]`：施工圖規格備註（板材型號、預留尺寸…），顯示在屬性面板。
- `parametric.kind` 另有 `toilet` / `sink` / `hob`（衛浴與廚房設備）、`roundtable`（單柱圓桌，`size[0]`=直徑）、`shelf`（壁掛立柱層架，`count`=層板數）；cabinet 的 `count` = 門片數。

---

## 專案紀錄：鴻築麗苑（柏毅室內裝修工程行，2026/10/19 施工圖，5 頁）

- 來源 PDF：平面配置圖 / 插座圖 / 燈具圖 / 開關圖 / 系統櫃立面圖（第 5 頁）。已轉成 `public/inputs/floorplans/hongzhu-{1-plan,2-outlets,3-lights,4-switches}.png`，四張**已對位成同一框**（3300×… 取同一裁切框，`widthMeters = 10.264`，`offset=[0,0]`），可無縫切換。
- **世界原點 = 建物外包（含結構柱）中心**。比例由圖上標註 `100 / 275 / 302` 實測（≈2.348 px/cm @300dpi，並以 185、75、67.5 等標註交叉驗證）：外包約 **950 × 667 cm**。⚠️ 與使用者口述的「約 750 × 520」「230」不同——圖面實測為準；`230` 在圖上實為 `280/302`。圖面備註：**尺寸為包外**。
- 圖面 `185` 是**主臥室內寬**不是床寬；床（洋紅框）實測約 155×200。十字叉方塊＝主臥衣櫃（71 深、200 長）。
- 圖面手寫藍字：「有管道 / 一樣的話保留」→ 管道間 `part-shaft` 保留；「改乾濕分離滑門」；「改推門」。
- **估計項目**（圖面未明示）：乾濕分離玻璃位置、衛浴門位置、各插座中未標高度者（`assumed:true`）、開關高度（預設 120，主臥入口 100 為圖面值）、窗尺寸高度（台 37.5 / H194.9 取自圖面標註）。
- 材質：地板 ED-KS81555（內建淺橡貼圖）、百合白 `#F7F5F0` 蛋殼光 0.65、EGGER W1000 ST19 / U708 ST9 / U727 ST9；玄關落塵區依使用者選的實景參考右版使用 `builtin:encaustic` 花磚（原圖面 CW025501 灰磚仍在材質庫）。
- **rev 11**：圓桌 `f-round` 移到餐桌後牆（part-south 南面、電視牆東面到主臥滑門洞）中央 `[-0.3, 0, 0.45]`。這面牆場景 185.5 cm、施工圖約 181 cm，使用者實量 170 cm，差異原因待使用者確認量測端點，牆未改。
- **rev 10**：依使用者截圖把沙發預設改成：兩個 90 橄欖綠模組緊貼西牆併排（`f-sheeper-a` z=-0.82、`f-sheeper-c` z=-1.72，x=-4.145，rotationY 90），60 黑色模組 `f-sheeper-b` 斜放在其南側 `[-4.0, 0, 0.0]`、rotationY 60（角度為依截圖估計，請以實際調整為準）。全屋尺寸驗算表見專案檔案 `sheeper-sofa/dimension-audit.md`：場景與施工圖差 ≤ 3 cm；使用者實量的「170cm 牆」尚待確認是哪一面。
- **rev 9**：①組綿羊拆成三件獨立家具 `f-sheeper-a/b/c`（目錄 `sheeper-module-90-head` / `-60` / `-90`，各自可選取、移動、換材質；z = -0.22 / -0.97 / -1.72，x = -4.145，rotationY 90，併排總寬仍 2.4）。②玄關花磚區 `z-foyer` 寬 191 → **160 cm**（西側仍貼牆內面 x=-4.6，東緣由 -2.69 縮到 -3.0），center `[-3.8, 2.11]`、size `[1.6, 1.55]`；其餘家具未動。③使用者說明「多功能房間 = 客廳」：原「次臥 / 多功能房」（part-tv 以西、北牆窗邊的房間）就是客廳，名稱改為客廳（北牆窗名、第一人稱 hotspot `second` →「客廳入口」）；沙發在此房內、圓桌在半牆南側的餐廳區。
- **rev 8**：客廳靠西牆新增 Sheeper「組綿羊」模組沙發 `sheeper-modular-sheep-90-60-90`（`parametric.kind = modsofa`，90+60+90 cm、深 90、高 78，座面約 43 cm、頭靠 50 cm；尺寸依 sheeper.com.tw 官網：單椅 90/65×95×78、椅凳高 43、頭靠 50×15×20）。兩個 90 為橄欖綠貓抓布、60 為黑色，新 archetype `fabric_scratch`（斜紋織理微紋理）、品牌字典 `SHEEPER-SCRATCH-OLIVE/BLACK`（Hex 皆為估計）。位置 `[-4.145, 0, -0.97]`、`rotationY 90`（背靠西牆內面 x=-4.6，南北夾在北角柱與儲藏室之間）。圓桌 `f-round` 依使用者截圖移到 part-south 隔間牆南面、玄關側牆段（`[-0.5, 0, 0.45]`，位置為依截圖估計）。第一人稱「客廳沙發」立足點改為坐在沙發上。
- **rev 5**：使用者確認主臥衣櫃 **200**（依 p5 立面）、浴室保留磁磚。為了不讓衣櫃擋門，浴室門洞由圖面的 z −1.50~−0.71 往南移 33cm 到 **z −1.17~−0.42**（仍為 75 寬），門邊開關移到門南側。
- **rev 4（使用者回饋修正）**：浴室門改到「衛浴/主臥隔間」（從主臥進入，圖面 75 開口 z −1.50~−0.71）；主臥衣櫃暫縮為 170（rev 5 已改回 200）；乾濕分離改為北側淋浴區；地板除玄關花磚外皆為木地板（陽台也改木地板；浴室保留磁磚——使用者已確認）；結構柱外凸 1cm 避免共平面閃爍；底圖預設隱藏；施工圖圖層改用去除手寫標註的版本；手繪參考圖已去除 Procreate 介面與手寫數字。
- **rev 3（材質對照更新）**：依實景 AI 圖與手繪材質圖調整——地板改為灰褐橡木 `builtin:oak-ash`（手繪的棕色僅代表「木地板」，未採用）、衛浴深灰磁磚、淋浴區大理石、陽台木地板、廚具橘棕木色、床粉色寢具；進門左側儲藏櫃改 3 門 + 72cm 電子衣櫥壁龕（`niche`）並放入 `lg-styler`（LG 電子衣櫥 5 件式 60×196.5）。玄關仍為花磚，非手繪的藍色。參考圖在 `public/inputs/references/`（已加入 `layout.references`）。
- 初版資料由 `scripts/gen-hongzhu-data.py` 產生（rev 2；之後以 JSON 直接 Diff 修改，勿重跑覆蓋）（可讀作座標來源紀錄；之後的微調直接改 JSON，並依 `/update-room` 的 Diff 原則，不要重跑覆蓋使用者的調整）。

---

## 視覺輸入處理手冊（Claude 必讀）

### A. 平面施工圖 → `defaultLayout.json`（`blueprint` / `floor` / `walls` / `furniture`）

1. 用 Read 讀圖（圖在 `public/inputs/floorplans/` 或對話中）。取得**圖片像素尺寸** W×H（例如 `file`/PIL：
   `python3 -c "from PIL import Image;print(Image.open('x.png').size)"`；SVG 讀 `width/height/viewBox`）。
2. 找**比例依據**，優先序：圖上標註尺寸（如 `5400`、`3.2m`）> 比例尺線 > 比例文字（1:100）> 標準構件（門寬 0.9 m、單人床 1.0 × 2.0 m、廚具深 0.6 m）。
   算 `pxPerMeter = 兩點像素距離 / 實際公尺`。多個依據請互相驗證，誤差 > 3% 要重新檢查。
3. `blueprint.widthMeters = W / pxPerMeter`；`blueprint.offset = [0, 0]` 代表**圖片中心**放在世界原點。
4. 把圖上每個點的像素 `(px, py)` 轉世界座標（圖片中心為原點）：
   `x = (px − W/2) / pxPerMeter`、`z = (py − H/2) / pxPerMeter`（圖片 +y 向下 = +Z 南）。
   圖片若不是「上北下南」，先決定要旋轉 `blueprint.rotation` 還是直接把座標旋轉（建議用 `rotation` 對齊圖片，其餘座標維持世界座標）。
5. 填 `floor.center/size`（室內淨空的外接矩形）。非矩形房間：`floor` 取外接矩形，牆照實際畫出。
6. 填 `walls`：以牆的**中心線**取點（淨空邊 + 厚度/2），圖上是雙線牆就取兩線中間；每面牆分別寫 `start/end`、`height`（無標示用 2.6）、`thickness`（無標示用 0.12，外牆 0.15–0.24）。
   門窗：`at = 開口中心到 start 的距離`；`width/height/sill` 用圖上標註，沒有就用門 0.9×2.1、窗 1.5×1.2 sill 0.9，並在回覆中說明是估計。
7. 圖上若有家具外框，對應到 `catalog.json` 最接近的 `catalogId`，用其外框中心當 `position`，量測長寬當 `size`，朝向換算成 `rotationY`（正面朝南=0）。
8. 完成後**自我驗證**：`blueprint.widthMeters / 圖片長寬比` 得到圖高；用兩個已知尺寸（如牆長）回算像素是否吻合；遞增 `rev`。
9. 回覆時列出：使用的比例依據、算出的 `widthMeters`、估計/假設的項目。

### B. 實景照片 / AI 3D 渲染圖 → 色彩與材質

1. 用 Read 看圖，辨識**牆面、地板、主要家具、窗簾/軟裝**各自的主色。
2. 取色：不要憑感覺猜 Hex。有需要時用 Python 對指定區域取平均色：
   ```bash
   python3 -c "from PIL import Image;im=Image.open('public/inputs/references/x.jpg').convert('RGB');w,h=im.size;box=im.crop((int(w*.1),int(h*.1),int(w*.3),int(h*.3))).resize((1,1));print('#%02x%02x%02x'%box.getpixel((0,0)))"
   ```
   （牆面避開陰影/高光，取中間調；受暖光影響時略為校正，並於回覆中說明。）
3. 判斷質感 → `roughness/metalness`：平光牆漆 0.95、蛋殼 0.6、亮面漆/石材 0.25、拋光磚 0.15–0.3、木地板 0.5–0.65、織布 0.9–1、金屬 metalness 0.8–1。
4. 判斷材質種類 → `map`：木紋地板 `builtin:oak` / `builtin:walnut`、方磚 `builtin:tile`、清水模 `builtin:concrete`、織布 `builtin:fabric`、大理石 `builtin:marble`；`color` 用 `#ffffff` 保留貼圖原色，或用取得的顏色去染色。
   要用照片本身的材質：用 Pillow 裁出一塊無陰影的方形區域（建議 512–1024 px），存到 `public/inputs/references/crops/` 或 `public/inputs/products/`，再把 `map` 設為該 URL，並用 `repeat` 調整每公尺重複次數（磁磚大小約 0.6 m → `repeat ≈ 1.6`）。
5. 更新 `defaultLayout.json` 的 `floor.material`、`walls[].material`、`furniture[].materials`（或 `catalog.json` 的 `parametric.materials`），並把該圖加入 `references`（讓使用者能在對照視窗看）。
6. 這類圖片**不用於推算幾何尺寸**（除非圖中有已知尺寸物件並說明誤差）。

### C. 商品照片 / AI 生成的 3D 家具圖 → `catalog.json`

1. 讀圖，確認主體、是否已去背（PNG alpha）。沒去背也可先用，但回覆中提醒去背效果更好；有 `rembg`/Pillow 可用時可自行去背。
2. 取得真實尺寸：優先用使用者提供/商品頁標示的 W×D×H；沒有就依品類用常識估計並明說。
3. 長寬比檢查：`billboard` 的圖片會被拉成 `size[0] × size[1]`，所以 **`size[0] / size[1]` 必須 ≈ 圖片 寬/高 (主體去背後的外框)**；不符就以高度為準重算寬度。
4. 新增 `catalog.json` 項目：
   - 只有照片 → `mode: "billboard"`，`billboard.image` 指向 `/inputs/products/...`，`size = [寬, 高, 深]`（深度是真實家具深度，用來佔位與碰撞框）。
   - 有 `.glb` → `mode: "glb"`，`size` 填真實尺寸（`fit: "stretch"`）。
   - 想貼在系統櫃/桌面表面 → `mode: "parametric"` + `decals`。
   - 能用基本積木組出來 → `mode: "parametric"`，並從照片取主色/次色/點綴色填 `materials`。
5. 需要時一併在 `defaultLayout.json` 放一個實例讓使用者立刻看到。

### D. 通用規範

- **Diff 原則**：更新既有專案時只改圖面確實變動的項目，**不覆蓋使用者手動微調過的家具座標**（見 `/update-room`）。

- 只改資料，不要為了單一圖片去改場景程式；真的缺功能（新的 `kind`）才改 `src/scene/Furniture.tsx` 並同步更新本文件與 `types.ts`。
- 檔案放哪：施工圖 → `public/inputs/floorplans/`；照片/渲染圖 → `public/inputs/references/`；商品圖與 `.glb` → `public/inputs/products/`。
  URL 一律用 `/inputs/<資料夾>/<檔名>`（根路徑，無 `public`）。檔名請避免空白；中文檔名可以，manifest 會自動 `encodeURIComponent`。
- 改完請 `npm run build`，並在回覆中說明：改了哪些檔案/欄位、依據的比例或取色來源、哪些是估計值。

---

### v2 渲染原則：動靜分離雙態渲染（目標 iPhone 15/17 Pro、iPad、MacBook Pro M1 Pro / Chrome）
- **互動中 vs 定格**（`src/lib/frameloop.ts`）：拖曳 / 縮放 / 按鍵 / 動畫 / 載入時連續出幀，dpr [1, 1.25]、N8AO 半解析度 performance、旁路景深；停下 180 ms 後 dpr [1.5, 2]、全解析度 N8AO high + Bloom + 光學景深，補 3 幀定格後 `frameloop = demand`（GPU 閒置）。**靜止畫面是相片級品質，降級只發生在互動中。** 狀態由 DOM 事件與計時器切換，不在 `useFrame` 內 setState。
- 互動中 FPS 監看（rAF，只量互動期間）：平均 > 26 ms 連續一窗 → level 1（dpr 降到 1），再掉 → level 2（互動中關 AO）；恢復後逐級回升。不影響定格畫質。
- 新增動畫若超過 1.2 s，要呼叫 `wake(ms)`。
- **陰影圖手動更新**：`gl.shadowMap.autoUpdate = false`，只在 layout 資料 commit（拖拉 / 位移軸放開）、切換視角、資源載入後重算（`dirtyShadows()`）。**全場景只有 2 盞燈投影**（客廳吊扇 `fan-liv`、主臥吸頂 `ce-master`，1024），其餘燈具只有光照；不要再增加投影光源。
- 接觸陰影 `frames=1`，資料變動時換 key 重烘。
- 地板光澤：`MeshPhysicalMaterial` + 場景 HDRI（`Floor.tsx` 的 `FLOOR_ENV_INTENSITY`，目前 0.3；1.2 會讓地板偏粉偏亮）+ clearcoat 0.15；已移除 `MeshReflectorMaterial`。
- 燈具：`src/scene/Fixtures.tsx` 位置全取自 `mep.json`，固定 4000K、全迴路開啟。軌道燈頭瞄準點寫在該檔 `TRACK_AIM`。
- `PostFX.tsx` 順序 N8AO → **children（景深，只在定格時掛）** → Bloom → WarmGrade → ToneMapping(ACES) → Vignette → SMAA；Canvas 原生 `antialias:false, stencil:false`。標準對色光（`colorProof`，不沿用存檔）只有 Neutral 色調映射 + SMAA。

### PBR 掃描貼圖與 HDRI（Poly Haven, CC0）
- `scripts/optimize-textures.mjs`（`--max 1024`，`--dry` 先看結果）壓縮 / 縮小貼圖；地板與磁磚組預設維持 2048。
- `node scripts/fetch-textures.mjs` 會下載原始檔；**提交進 repo 的是瘦身後的版本**：地板 / 磁磚 2k（diffuse / normal / 單通道 roughness，約 2.6 MB 一組），板材微紋理 1k，無 AO 圖（AO 由 N8AO 即時算），HDRI 只留 `public/hdri/interior-1k.hdr`。總量約 8 MB。
- `MaterialSpec.pbr = '<slug>'` 綁定（`src/lib/pbrTextures.ts` 的 `PBR_SETS`，`meters` = 一張涵蓋的公尺數、`size` = 檔案解析度）。`pbr: false` 強制停用。`egger_st19` / `egger_st9` archetype 預設自動套用（只取 Normal + Roughness）。
- 對應：ED-KS81555 → `laminate_floor_02`；CW025501 → `large_grey_tiles`；EGGER ST19 → `white_oak_veneer`；ST9 → `grey_plaster_02`。⚠️ 皆為最接近的替代品，非同型號。
- 材質用到才載入；已載入的貼圖共用同一份 GPU 上傳。

## 資料檔注意事項

- **瀏覽器會把使用者的格局自動存在 localStorage（key `interior-planner:v1`）**，所以改了 `defaultLayout.json` 預設不會影響已開啟過的瀏覽器。
  → 每次修改 `defaultLayout.json` **請把 `rev` +1**：載入時若本機存檔的 `rev` 較舊，會改用新預設並把舊存檔放進復原堆疊（Ctrl+Z 找回）。
  只改 `catalog.json` 不需要 `rev`（目錄每次載入都讀最新）。
- 匯出的 `layout.json` 含 `customCatalog` 與 `references`，匯入時會經過 `normalizeLayout()` 驗證（需有 `floor` / `walls` / `furniture`）。
- UI 上傳的圖片會被縮圖並以 data URL 存進 layout（LocalStorage 約 5 MB 上限，超過會 toast 提示改用匯出）。要長期保存請把檔案放進 `public/inputs/`。
- `<Environment preset="apartment" />` 的 HDR 由 drei 從 CDN 載入；離線或被擋時 `Lighting.tsx` 會退回半球光 + 方向光（不會崩潰）。
  要完全離線可下載 HDR 放到 `public/` 並改用 `<Environment files="/hdr/apartment.hdr" />`。

## 程式風格 / 慣例

- TypeScript strict；`noUnusedLocals`。Tailwind v4（`@import 'tailwindcss'`），面板樣式用 `.glass`。
- 場景高頻更新（拖拉、破牆）一律**直接改 Three 物件**，只在結束時 commit 進 store，避免每幀重繪 React 與觸發 localStorage 寫入（儲存另有 400 ms debounce）。
- 會連續觸發的編輯（滑桿、數字輸入）呼叫 store 時帶 `key`，900 ms 內同 key 合併為一筆復原紀錄。
- 手機/平板（< 1024px）改用底部抽屜；桌面是左右浮動面板。新增面板內容請放進 `CatalogPanel / BlueprintPanel / ReferencePanel / PropertiesPanel` 以兩邊共用。
- **點選 ≠ 移動**：點擊只選取；要移動需按屬性面板「移動」或 `M` 進入移動模式（`uiStore.moving`），拖拉放開後自動結束（位移軸/旋轉環則按「完成移動」/ Enter / Esc）。鎖定（`locked`）的物件不能移動、旋轉、刪除。
- 色彩：使用 `THREE.NeutralToneMapping`（保留色票原色），4000K 為中性白、3000K 偏暖、6000K 偏冷；apartment HDR 偏暖，已用略冷的天光抵銷。新增共平面的幾何（重疊的牆、疊放的地板分區）會 z-fighting 閃爍——牆已有逐面 polygonOffset、地板分區逐層墊高 1mm，新增物件請避免與牆面完全共平面。
- 鍵盤：`M` 移動模式、`R` 旋轉 90°（Shift+R 反向）、`Backspace/Delete` 刪除、`Space` 平面圖 ⇄ 斜視、`Ctrl+Z/Shift+Z` 復原/重做、`Ctrl+D` 複製、`Ctrl+S` 匯出、`Esc` 取消選取/結束校準。

## v2 介面精簡（2026-10-25）
- 移除：四方位按鈕、燈光色溫與燈光情境、後期品質選項、相片級算圖 / 路徑追蹤 / 4K 匯出、放置立足點與預設立足點列、第一人稱的高度 / 視角 / 退後滑桿與景深開關（景深固定開、退後固定 50 cm、站高 168 cm）。
- 第一人稱 = 工具列一鍵（從玄關進門開始，下次回到上次位置）；底部只留 站立 / 坐姿 / 低視角 與「俯視」。
- 家具目錄只保留預設格局實際用到的 25 項（含綿羊沙發三件、圓桌、rareraw 層架、床、各櫃體與設備）。GLB / 立牌 載入模式仍支援（供使用者自訂商品）。
