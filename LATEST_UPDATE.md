# 最新更新

版本：v171.6.3

## 教材進度圖加入教材分類

- 英文教材進度分成「學測／補充」；Unlock 3、Azar 與 Essential Grammar in Use 歸入補充，其餘學測教材依原資料顯示。
- 數學教材進度分成「複習講義（兩冊以上一本）／分冊講義（一冊一本）」。
- 自然教材進度依「物理／化學／生物／地科」分段，相同科目的不同講義會排在同一區。
- 國文維持原本教材排列，不額外增加重複標題。
- 分類只影響顯示順序及標題；完成頁數、完成百分比、深淺交錯與既有資料都不變。

更新資料夾：`gsat-study-tracker-v171.6.3-material-progress-groups`

## 驗證

- 370 項單元／回歸測試通過。
- TypeScript 型別檢查與 Vite 正式建置通過。

本次不更動資料格式，不需要新增 Supabase migration，也不需要重新部署 Supabase Edge Function；網站重新建置部署即可。

## Commit 建議

`feat(progress): group materials by study category`
