# 3D 室內裝潢與格局動態規劃系統

Vite + React + TypeScript + Tailwind + Three.js（R3F / drei）+ zustand，部署於 Cloudflare Workers（Static Assets）。

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # 型別檢查 + 打包到 dist/
npm run deploy     # build + wrangler deploy
```

## 功能

- **等距俯視角（世紀帝國視角）**：預設正交相機，一鍵切換透視；東南/西南/東北/西北 + 正上方平面圖視角；`Space` 循環切換。
- **智慧破牆**：擋住視線的外牆自動降為 30 cm（矮牆）或變 15% 透明，轉開鏡頭即恢復。
- **PBR 材質**：牆面油漆（Hex + 平光/蛋殼光/亮光）、貼圖 URL / 上傳 / 實景照片裁切、Repeat Scale、Roughness、Metalness。
- **施工圖描圖層**：放在 3D 地板下方，可輸入圖片實際寬度（公尺）、調透明度，或用「兩點量測」校準比例。
- **實景 / 靈感對照視窗**：懸浮、半透明疊加（Onion Skin）、左右分割；吸管取色後可一鍵套用到牆/地板/家具。
- **混合式家具載入器**：`.glb` 模型、參數化 PBR 積木（可貼商品照）、2.5D 智慧立牌（含真實長寬高碰撞框）。
- **自動儲存** 到 LocalStorage；可匯出/匯入 `layout.json`；復原/重做。
- **RWD**：桌面左右面板；手機/平板為底部抽屜 + 精簡浮動膠囊，拖拉家具時不會誤轉背景。

## 放入你的素材

| 資料夾 | 內容 |
| --- | --- |
| `public/inputs/floorplans/` | 平面施工圖 |
| `public/inputs/references/` | 實景照片、AI 3D 渲染圖 |
| `public/inputs/products/` | 商品去背照（PNG）、`.glb` |

放進去後重新整理頁面，UI 左側抽屜即可選用。資料格式與座標系統見 [`CLAUDE.md`](./CLAUDE.md)。
也可以直接把圖片交給 Claude：它會依 `CLAUDE.md` 的規則讀圖、算比例/取色，並更新 `defaultLayout.json` / `catalog.json`。

> 原本根目錄的 `index.html`（工程報價單試算）已搬到 `public/legacy/quote-estimator.html`，部署後仍可由 `/legacy/quote-estimator.html` 開啟。
