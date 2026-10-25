---
description: 讀取新的施工圖 / 實景照 / 渲染圖 / 商品圖，精準更新 defaultLayout.json、catalog.json 與材質，並驗證建置
argument-hint: [檔案路徑 ...]（省略則掃描 public/inputs/ 最新檔案）
allowed-tools: Read, Edit, Write, Bash, Glob, Grep, WebSearch, WebFetch
---

# /update-room — 視覺輸入 → 3D 資料更新

輸入：`$ARGUMENTS`

開始前先讀 `CLAUDE.md`（座標系統、Schema、〈視覺輸入處理手冊〉），並嚴格遵守。

## 1. 掃描輸入源
- `$ARGUMENTS` 有給路徑/檔名 → 只處理這些檔案（路徑不存在就先用 Glob 找 `public/inputs/**` 同名檔，找不到再詢問）。
- `$ARGUMENTS` 為空 → 以 `ls -t public/inputs/{floorplans,references,products}` 找**最新加入**（mtime 最新、且 git 未追蹤或比 `src/data/*.json` 新）的圖片 / PDF / `.glb`，列出清單後處理。
- 使用者直接貼在對話中的圖片也算輸入：**先存成檔案**到 `public/inputs/references/`（或 floorplans / products），之後才能程式取樣、裁切貼圖，也方便下次比對。若對話中的圖片在環境裡找不到檔案，要明確告訴使用者並請他把原檔放進 `public/inputs/`。
- 若是 PDF，用 `Read` 的 `pages` 參數逐頁讀；轉成底圖時用 `pdftoppm -r 300 -png -hide-annotations`（**去掉 iPad/Markup 手寫標註層**），存到 `public/inputs/floorplans/`（多頁 = 多張底圖圖層，並對位成同一框）。

> **使用者規則：輸入圖片上的手寫痕跡（手寫數字、批註、圈選、塗鴉文字）一律不要出現在專案的底圖 / 參考圖裡。**
> 手寫內容只用來「讀資訊」，產出的圖檔要移除：PDF 用 `-hide-annotations`；點陣圖用中值濾波局部修補或裁掉邊緣，並把 App 介面（例如 Procreate 工具列）裁掉。

## 2. 依類型分流解析（每個檔案先判斷類型，可混合）

### A. 施工圖 / 平面圖 / 立面圖 / 水電圖
1. 逐頁讀圖，**完整抄錄**：尺寸標註（先判斷是「包內」還是「包外」尺寸，圖面備註會寫）、紅字批註、**手寫藍字修改**（如「改推門」「有管道間」「一樣的話保留」）、水電高度（`H:30`、`W:108` 的 W=離左牆水平位置、H=離地高度）、材料型號。
2. 建立比例：用圖上標註尺寸算 `pxPerMeter`，至少兩個獨立依據互相驗證（誤差 > 3% 重查）。
3. **做 Diff，不要重建**：把圖面內容轉成「應有的牆/門窗/櫃體/水電點」，與現有 `src/data/defaultLayout.json` 逐項比對（以 `id` 與位置對應）。
   - 只更新**確實不同**的牆體座標、門窗、櫃體尺寸、水電/燈具點位。
   - **絕對不可覆蓋使用者已手動微調的其他家具座標**：任何圖面沒提到、或與圖面一致的 `furniture[]` 項目一律保持原樣；若不確定某件家具是否為使用者調整過，保留並在回報中列為「未動」。
   - 圖面與現況衝突且無法判斷時，列出衝突詢問，不要自己硬改。
4. 圖面的手寫修改優先於印刷內容；有衝突在回報中註明採用哪一個。
5. 若是新圖版，更新 `blueprint` 圖層（見 CLAUDE.md〈施工圖圖層〉），確保各圖層對位。

### B. 品牌建材 / 色號 / 系統櫃 / 實景照 / AI 渲染圖

建材一律走「品牌建材物理引擎」：`src/data/brandMaterials.json`（字典）+ 五種 Archetype（`src/lib/archetypes.ts`）。**嚴禁只改 Hex 色碼**，也不要憑感覺猜色。

#### B1. 使用者指定「品牌 + 型號 / 色號」（例：「主牆改成得利竹炭百合白」「衣櫃改成 EGGER H3730 ST10」）
1. **先查字典**：在 `brandMaterials.json` 用 `brand` / `code` / `name` 搜尋。有 → 直接用，跳到第 4 步。
2. **字典沒有 → 必須呼叫 `WebSearch`**（查不到再 `WebFetch` 官方頁）：
   - 官方色號的 RGB / Hex（品牌官網、官方色卡 PDF、經銷商規格頁）。
   - 表面處理特性：消光 / 亮面 / 木紋 / 石紋、壓紋名稱（ST9、ST19、ST10…）、是否有透明耐磨層。
   - 查詢可用中英文各一次（例：`Dulux 得利 <色名> 色號 RGB`、`EGGER <型號> <壓紋> NCS hex`）。
3. **不准瞎猜**。依可信度填 `hexConfidence`：
   - `official`：來源直接給 RGB/Hex。
   - `measured`：專案圖面 / 實景照用 Pillow 取樣並校正光線偏色。
   - `reference`：只有 NCS / RAL / Pantone 等官方參考色 → 說明是換算值。
   - `estimate`：查不到、目視估計 → **必須如實標示**，並在回報中請使用者用實體色卡確認。
   `source` 欄位寫網址或出處；`description` 寫表面處理特性。
4. **綁定物理基底 Archetype**（依表面特性選，不要預設 paint）：
   | archetype | 適用 | roughness | 其他 |
   | --- | --- | --- | --- |
   | `paint_eggshell` | 乳膠漆（蛋殼 / 平光） | 0.72（蛋殼 0.6–0.72，平光 0.85–0.95） | clearcoat 0.05，滾塗顆粒 |
   | `egger_st9` | EGGER ST9 / Smoothtouch 柔霧面素色板 | 0.55 | reflectivity 0.3 |
   | `egger_st19` | EGGER ST19 / 深壓紋消光（W1000 ST19 等） | 0.62 | clearcoat 0.08、clearcoatRoughness 0.6，直向壓紋 |
   | `laminate_wood` | 超耐磨木地板、仿木貼面 | 0.45 | clearcoat 0.15、clearcoatRoughness 0.4，拼縫由 albedo 導出 |
   | `matte_tile` | 霧面石英磚 / 石材 | 0.5 | metalness 0.05，填縫 + 微石材顆粒 |
   其他壓紋（如 ST10、ST12、ST15）選最接近的 archetype，並調整 `roughness` / `bumpScale`（壓紋越深越大），在 `description` 說明。無合適基底（亮面、金屬、玻璃）才可不設 archetype，並調 `roughness` / `metalness` / `clearcoat`。
5. 新增 / 更新字典項目（欄位見 `types.ts` 的 `BrandMaterial`），再把該項目的 `archetype / color(有 map 用 #ffffff) / roughness / metalness / clearcoat / clearcoatRoughness / reflectivity / bumpScale / map / repeat` **完整**寫到目標物件的 `MaterialSpec`（牆 `walls[].material`、地板 `floor.material`、分區 `floorZones[].material`、家具 `furniture[].materials` 或 `catalog.json` 的 `parametric.materials`）。UI 的「品牌色卡」就是用同一份欄位套用，結果必須一致。
6. 木紋 / 石紋板材若沒有對應貼圖：先用最接近的 `builtin:*`（`oak-ash` / `oak` / `walnut` / `marble`…）並標為估計。

#### B2. 使用者提供實景照片或材質樣板照
同時分析三件事，**用程式取樣，不要目測**（Pillow，避開陰影 / 高光，取中間調）：
1. **固有色 Albedo**：排除現場燈光偏色。用照片中已知白（白牆、白色對照卡）做白平衡校正，說明校正方法與係數，填 `hex`。
2. **高光擴散 → Roughness**：高光點小而銳 → 0.15–0.35；寬而糊 → 0.5–0.7；幾乎看不到高光 → 0.75–0.95。有明顯透明耐磨層反光 → 加 `clearcoat`（0.1–0.2）。
3. **表面顆粒方向 → Normal / Bump**：直向細紋 → `egger_st19`；均勻細顆粒 → `egger_st9` 或 `paint_eggshell`；板材拼縫 / 填縫 → `laminate_wood` / `matte_tile`；紋路強度對應 `bumpScale`（0.2 細緻 … 1.0 明顯）。
接著**先寫入 `brandMaterials.json`**（`hexConfidence: "measured"`，`source` 寫照片檔名與取樣區域），**再**套用到場景資料。要用照片本身的紋理：裁一塊無陰影的方形區域存 `public/inputs/references/crops/`，設為 `map`（archetype 的微紋理會從該圖導出）。圖加入 `layout.references`。

#### B3. 只有圖面上的型號文字（施工圖 / 立面圖）
照 B1 的流程逐一處理每個型號，不要把圖面上的顏色（手繪示意色）直接當作材質色。

### C. 家具 / 家電商品圖
1. 取得真實長寬高：使用者提供 > 圖面標註 > 常識估計（估計要註明）。
2. 在 `src/data/catalog.json` 新增項目：有 `.glb` → `mode:"glb"`；能用積木組 → `mode:"parametric"`；只有照片 → `mode:"billboard"`（`size[0]/size[1]` ≈ 圖片長寬比）。`size` 即真實碰撞體積（Bounding Box）。
3. 在 `defaultLayout.json` 放置實例：貼齊地面（`y=0`）、貼牆但**不穿牆/不與既有家具重疊**（用牆內緣 = 中心線 ∓ 厚度/2 與既有家具 AABB 檢查），朝向正面朝室內。

## 3. 驗證
1. 若修改了 `defaultLayout.json` → `rev` +1。
2. 新增 / 修改的 `brandMaterials.json` 項目都必須有 `archetype`、`hexConfidence`、`source`；`archetype` 必為五種之一。
3. 執行 `npm run build`（含 tsc）。失敗就修到通過；必要時以 dev server + 無頭瀏覽器截圖確認畫面。
4. 檢查 JSON：所有 `catalogId` 都存在、id 不重複、單位為公尺。

## 4. 回報（條列）
- 處理了哪些檔案、各自判斷的類型
- 比例依據與算出的數值
- 變更清單：尺寸 / 座標 / 牆體門窗 / 材質（型號→hex、archetype、roughness、色值可信度與來源）/ 水電燈具點位（含高度）
- 刻意保留未動的項目（使用者已調整者）
- 估計 / 假設 / 圖面衝突之處
- 最後詢問：**是否要透過 `npm run deploy`（wrangler）部署更新到 Cloudflare Workers？**（未經同意不要部署）
