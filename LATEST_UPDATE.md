# 最新更新

版本：v171.6.6

## 數學頁數面板垂直置中

- 「今日數學頁數」與「本週數學頁數」都固定放在面板的上下正中央。
- 數字、進度條及百分比仍然維持靠左，不改成水平置中。
- 保留今日完成時間切換時的高度與淡入移動動畫。

更新資料夾：`gsat-study-tracker-v171.6.6-math-metrics-vertical-center`

## 驗證

- 372 項單元／回歸測試通過。
- 9 項 Chromium 瀏覽器流程測試通過，包含兩個數學面板的實際位置量測。
- TypeScript 型別檢查與 Vite 正式建置通過。

本次不更動資料格式，不需要新增 Supabase migration，也不需要重新部署 Supabase Edge Function；網站重新建置部署即可。

## Commit 建議

`fix(ui): vertically center left-aligned math metrics`
