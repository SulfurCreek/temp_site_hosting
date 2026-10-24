# CLAUDE.md — 3D 室內裝潢與格局動態規劃系統

Vite + React 19 + TypeScript + Tailwind v4 + Three.js（`@react-three/fiber` / `drei`）+ zustand。
部署目標：**Cloudflare Workers（Static Assets）**。

## ⚠️ 最重要的規則：視覺輸入必須自動轉成資料

> **當使用者提供平面施工圖、實景照片或商品照片時，Claude 必須自動使用視覺能力讀取圖片，計算比例或提取色彩/材質特徵，並直接更新 `src/data/defaultLayout.json` 或 `src/data/catalog.json`。**
> 不要只回覆文字描述，也不要請使用者手動輸入數字——先讀圖、算出數值、改檔，再告訴使用者改了什麼、哪些是估計值。

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
wrangler.jsonc               Cloudflare Workers Static Assets 設定
vite.config.ts               含 inputs-manifest plugin（掃描 public/inputs/*）
public/
  inputs/
    floorplans/              平面施工圖（PNG/JPG/SVG）→ 3D 地板下方的描圖層
    references/              實景照片 / 其他 AI 生成的 3D 渲染圖 → 對照懸浮窗
    products/                商品去背照（PNG）、.glb 模型 → 家具載入器
    manifest.json            （自動產生，勿手改）
  legacy/quote-estimator.html  原本放在根目錄的舊頁面，已搬到這裡
scripts/make-sample-glb.mjs  產生 sample-stool.glb 範例
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
    CameraRig.tsx            正交/透視雙相機、OrbitControls、四方位 + 平面視角轉場
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

- 只改資料，不要為了單一圖片去改場景程式；真的缺功能（新的 `kind`）才改 `src/scene/Furniture.tsx` 並同步更新本文件與 `types.ts`。
- 檔案放哪：施工圖 → `public/inputs/floorplans/`；照片/渲染圖 → `public/inputs/references/`；商品圖與 `.glb` → `public/inputs/products/`。
  URL 一律用 `/inputs/<資料夾>/<檔名>`（根路徑，無 `public`）。檔名請避免空白；中文檔名可以，manifest 會自動 `encodeURIComponent`。
- 改完請 `npm run build`，並在回覆中說明：改了哪些檔案/欄位、依據的比例或取色來源、哪些是估計值。

---

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
- 鍵盤：`R` 旋轉 90°（Shift+R 反向）、`Backspace/Delete` 刪除、`Space` 切換視角、`Ctrl+Z/Shift+Z` 復原/重做、`Ctrl+D` 複製、`Ctrl+S` 匯出、`Esc` 取消選取/結束校準。
