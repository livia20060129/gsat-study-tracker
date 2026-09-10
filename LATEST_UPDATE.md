# 最新更新

版本：v171.0.93

## 本次修正

- 所有自行新增的國文卡片，國文項目欄與選單固定占 1/2。
- 尚未選擇項目時，項目欄仍只占左半。
- 古今悅讀一百：項目占 1/2、回次占 1/4，最後 1/4 保留空間。
- 國文教材：項目占 1/2、起始頁與結束頁各占 1/4。
- 國文寫作第一列：項目占 1/2、題目占 1/2。
- 國文寫作第二、三列：左側分別放分數與題型，各占 1/4；右側改進方向占 3/4 並跨兩列。
- 手機窄螢幕仍會依響應式規則改成單欄，避免欄位過窄。
- Calendar 鎖定卡片及既有儲存資料格式不變。

## 更新檔案

- `src/legacy-app.ts`
- `src/styles.css`
- `tests/legacyCardRegression.test.ts`
- `package.json`
- `package-lock.json`
- `README.md`
- `LATEST_UPDATE.md`

更新資料夾：`gsat-study-tracker-v171.0.93-chinese-field-layout-update`

## 驗證

- 238／238 項測試通過。
- TypeScript 檢查通過。
- 正式 Vite 建置通過。

## Commit 建議

`feat(chinese): refine custom item field layout`
