---
description: 讀取新的施工圖 / 實景照 / 渲染圖 / 商品圖，精準更新 defaultLayout.json、catalog.json 與材質，並驗證建置
argument-hint: [檔案路徑 ...]（省略則掃描 public/inputs/ 最新檔案）
allowed-tools: Read, Edit, Write, Bash, Glob, Grep
---

# /update-room — 視覺輸入 → 3D 資料更新

輸入：`$ARGUMENTS`

開始前先讀 `CLAUDE.md`（座標系統、Schema、〈視覺輸入處理手冊〉），並嚴格遵守。

## 1. 掃描輸入源
- `$ARGUMENTS` 有給路徑/檔名 → 只處理這些檔案（路徑不存在就先用 Glob 找 `public/inputs/**` 同名檔，找不到再詢問）。
- `$ARGUMENTS` 為空 → 以 `ls -t public/inputs/{floorplans,references,products}` 找**最新加入**（mtime 最新、且 git 未追蹤或比 `src/data/*.json` 新）的圖片 / PDF / `.glb`，列出清單後處理。
- 使用者直接貼在對話中的圖片也算輸入；若是 PDF，用 `Read` 的 `pages` 參數逐頁讀，並用 `pdftoppm -r 200 -png` 轉成圖存到 `public/inputs/floorplans/`（多頁 = 多張底圖圖層）。

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

### B. 系統櫃 / 建材色卡 / 實景照 / AI 渲染圖
1. 提取：板材型號（EGGER W1000 ST19、U708 ST9 …）、油漆色號、木紋 / 磁磚 / 布料。色彩**用程式取樣**（Pillow 取區域平均色，避開陰影高光），不要憑感覺猜 Hex。
2. 估 `roughness` / `metalness`（消光板 0.7–0.85、蛋殼漆 0.6–0.65、木地板 0.5–0.6、磁磚 0.25–0.4…）。
3. 在材質庫註冊（`src/data/materials.json`，見 CLAUDE.md；型號作為 `id`/`name`），再把 `MaterialSpec` 綁到指定物件（牆 / 地板 / 家具 `materials` 或 catalog `parametric.materials`）。要用實景紋理：裁切後存 `public/inputs/references/crops/` 並設 `map`。
4. 把圖加入 `layout.references`，方便使用者在對照視窗比對。

### C. 家具 / 家電商品圖
1. 取得真實長寬高：使用者提供 > 圖面標註 > 常識估計（估計要註明）。
2. 在 `src/data/catalog.json` 新增項目：有 `.glb` → `mode:"glb"`；能用積木組 → `mode:"parametric"`；只有照片 → `mode:"billboard"`（`size[0]/size[1]` ≈ 圖片長寬比）。`size` 即真實碰撞體積（Bounding Box）。
3. 在 `defaultLayout.json` 放置實例：貼齊地面（`y=0`）、貼牆但**不穿牆/不與既有家具重疊**（用牆內緣 = 中心線 ∓ 厚度/2 與既有家具 AABB 檢查），朝向正面朝室內。

## 3. 驗證
1. 若修改了 `defaultLayout.json` → `rev` +1。
2. 執行 `npm run build`（含 tsc）。失敗就修到通過；必要時以 dev server + 無頭瀏覽器截圖確認畫面。
3. 檢查 JSON：所有 `catalogId` 都存在、id 不重複、單位為公尺。

## 4. 回報（條列）
- 處理了哪些檔案、各自判斷的類型
- 比例依據與算出的數值
- 變更清單：尺寸 / 座標 / 牆體門窗 / 材質（型號→色碼/roughness）/ 水電燈具點位（含高度）
- 刻意保留未動的項目（使用者已調整者）
- 估計 / 假設 / 圖面衝突之處
- 最後詢問：**是否要透過 `npm run deploy`（wrangler）部署更新到 Cloudflare Workers？**（未經同意不要部署）
