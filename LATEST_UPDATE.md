# 最新更新

版本：v171.1.22

## 本次修正

### 1. 所有可計時子項目獨立計入讀書時間

- 合併卡、互動題、回補項目及自然整合，統一逐一計算已完成子項目的分鐘數。
- 不再要求整張大卡的所有子項目都完成，單一已完成子項即可立即更新「今日完成時間」與科目圓環圖。
- 未完成子項即使已有分鐘，也不會提前計入。

### 2. 自然整合子卡可分別填時間與計時

- 物理、化學、生物、地科子卡各自提供「手動／計時」切換。
- 移除自然整合父卡的共用時間欄，避免父子時間重複計算。
- 舊版已填在父卡的時間，會在第一個已完成子項出現時安全移入該子項，保留既有紀錄。

### 3. 匯入驗證同步支援子項計時

- JSON 匯入會驗證自然整合子項的分鐘與計時狀態，避免不合法資料進入紀錄。

## 更新檔案

- `src/application/progressImport.ts`
- `src/legacy-app.ts`
- `src/types.ts`
- `tests/legacyCardRegression.test.ts`
- `tests/progressImport.test.ts`
- `package.json`
- `package-lock.json`
- `LATEST_UPDATE.md`

更新資料夾：`gsat-study-tracker-v171.1.22-child-time-update`

## 驗證

- TypeScript 檢查通過。
- 293 項自動測試全部通過。
- 正式 Vite 建置通過。

## Commit 建議

`fix(tracking): count completed child item study time`
