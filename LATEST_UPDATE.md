# 最新更新

版本：v171.6.20

## 作息時間版面修正

- 移除摘要後不再沿用原本 190px 的卡片高度，固定高度縮為符合目前內容的 156px，消除底部異常留白。
- 小時與分鐘輸入區由 42px 增加為 46px，並取消內層裁切，完整顯示輸入框的上、下及圓角邊框。
- 起床／就寢切換仍維持固定高度與原有過渡動畫；凌晨就寢的隔日提示也保留在固定空間內，不會讓版面跳動。
- 日期與今日狀態仍與作息卡等高，標籤及輸入控制維持上下置中、靠左排列。

## 驗證

- 新增瀏覽器幾何檢查，確認兩個時間輸入框完整落在輸入區內，不會再被裁切。
- 398 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置及 11 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.20-routine-card-required-files`
- `gsat-study-tracker-v171.6.20-routine-card-full-project`

## Commit 建議

`fix(routine): remove excess space and prevent input clipping`
