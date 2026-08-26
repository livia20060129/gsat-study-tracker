# GSAT Study Tracker v170

個人版 Study Tracker 的 TypeScript 漸進重構版本。

## v170 重點

### 數學進度單一來源

數學頁數規則集中在 `src/study/mathProgress.ts`：

- `extractCompletedMathPages()`：唯一的「哪些紀錄算數學進度」規則。
- `MathProgressIndex`：建立並維護歷史頁碼索引。
- `calculateMathProgress()`：唯一供 UI 使用的 pure calculation，回傳今日新增頁數、本週新增頁數、週目標與百分比。

已移除：

- `mathProgressHistory.ts`
- `weeklyMath.ts`
- MutationObserver／DOM guard 補丁
- legacy runtime 內另一套 `mathRecordKey`／`weekMathPageCount`／頁數加總 implementation

歷史資料只在初始化時完整建立一次索引；之後儲存、匯入與雲端同步皆以單日 record event 增量更新索引。

### 雲端同步版本比較

每筆 `StudyRecord` 新增 `updatedAt`。

同步時會比較：

- 本機 `updatedAt`
- Supabase `study_records.updated_at`

規則：

- 本機較新 → 保留本機並回寫雲端
- 雲端較新 → 採用雲端
- 內容相同 → 不重複覆寫
- 舊版本機紀錄沒有時間戳且與雲端不同 → 不自動覆蓋，保留本機；使用「補上本機舊資料」時才明確以本機版本解決舊資料衝突

這避免登入／重新整理時用舊雲端資料直接覆蓋較新的本機紀錄。

## 專案結構

```text
src/
├─ main.ts
├─ legacy-app.ts
├─ styles.css
├─ types.ts
├─ data/
│  ├─ mathCalendar.ts
│  └─ naturalCalendar.ts
├─ study/
│  ├─ defer.ts
│  └─ mathProgress.ts
├─ items/
│  └─ naturalIntegration.ts
├─ storage/
│  ├─ local.ts
│  └─ recordFreshness.ts
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

輸出在 `dist/`，由 GitHub Actions 部署至 GitHub Pages。
