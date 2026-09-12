# 最新更新

版本：v171.1.16

## 本次修正

- 修正圓環色帶與科目文字使用不同方向計算，造成「國、英」落在錯誤色帶的問題。
- 每個科目改用明確 SVG 圓弧繪製，色帶與文字共用同一組起點、終點及中心角度。
- 圓環中央固定顯示實際完成分鐘數，不再被科目百分比取代。
- 滑鼠移入或手機點擊時，百分比顯示於中央下方，並淡化其他科目以凸顯目前選取的科目。
- 移除 SVG 點擊後可能出現的黑色外框。

## 更新檔案

- `src/legacy-app.ts`
- `src/styles.css`
- `tests/subjectTime.test.ts`
- `package.json`
- `package-lock.json`
- `LATEST_UPDATE.md`

更新資料夾：`gsat-study-tracker-v171.1.16-restore-subject-dimming-update`

## 驗證

- 圓環色帶與科目文字位置已在實際瀏覽器逐項比對。
- 中央分鐘數與點擊百分比提示已在桌面版實際驗收。
- TypeScript 檢查通過。
- 全部自動測試通過。
- 正式 Vite 建置通過。

## Commit 建議

`fix(analytics): restore inactive subject dimming`
