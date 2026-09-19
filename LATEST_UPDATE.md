# 最新更新

版本：v171.6.21

## 作息時間底部空白

- 刪除作息卡底部原先供「此時間視為隔日凌晨」使用的獨立版面列。
- 作息卡固定高度由 156px 縮為 134px，輸入框下方只保留與其他邊緣一致的正常內距。
- 隔日凌晨提示改為條件式顯示在卡片右上角，不占用下方空間，也不會在起床／就寢切換時改變卡片高度。
- 小時與分鐘輸入框仍完整顯示，日期及今日狀態欄繼續與作息卡等高並上下置中。

## 驗證

- 瀏覽器測試新增底部距離限制，防止提示列或固定高度再次製造不合理空白。
- 398 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置及 11 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.21-routine-spacing-required-files`
- `gsat-study-tracker-v171.6.21-routine-spacing-full-project`

## Commit 建議

`fix(routine): remove reserved space below time inputs`
