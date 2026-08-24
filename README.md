# GSAT Study Tracker v168

v167 單一 HTML 的第一階段 TypeScript＋模組化重構版。

## 目標

1. **功能與資料相容優先**：沿用原有 localStorage／Supabase 資料格式。
2. **不導入 React／Vue／Svelte**：維持原生 DOM。
3. **逐步型別化**：先把單檔 JavaScript 移到 TypeScript 模組，再將高風險邏輯逐步抽離成嚴格型別模組。

## 專案結構

```text
src/
├─ main.ts
├─ legacy-app.ts              # v167 既有功能相容層
├─ styles.css
├─ types.ts
├─ data/
│  ├─ mathCalendar.ts
│  └─ naturalCalendar.ts
├─ study/
│  ├─ defer.ts
│  └─ weeklyMath.ts
├─ items/
│  └─ naturalIntegration.ts
├─ storage/
│  └─ local.ts
└─ ui/
   └─ dom.ts
```

## 開發

```bash
npm install
npm run dev
```

## 型別檢查

```bash
npm run typecheck
```

## 建置

```bash
npm run build
```

輸出會在 `dist/`，可直接部署 GitHub Pages。

## v168 的重構策略

`legacy-app.ts` 目前保留 `// @ts-nocheck`，原因是 v167 已有大量成熟功能與歷史資料相容邏輯。
這不是最終架構，而是避免「一次全部改寫」導致延期、自然整合、Calendar、Supabase 或舊資料遷移出錯。

已先建立嚴格 TypeScript 模組：
- `types.ts`：核心資料模型
- `study/defer.ts`：每週延期上限
- `study/weeklyMath.ts`：數學頁數計算
- `items/naturalIntegration.ts`：自然整合資料
- `storage/local.ts`：本機儲存介面
- `ui/dom.ts`：DOM 基礎工具
- `data/*`：Calendar 靜態資料

後續版本可以逐功能把 `legacy-app.ts` 裡的函式移到上述模組，直到完全移除相容層。
