# 最新更新

版本：v171.2.2

## 本次一次完成

1. 依紙本目錄更新「數學｜新關鍵｜3A～4A」頁碼對照。
2. 七個單元依序為：三角函數 p.2–30、指數與對數函數 p.31–57、平面向量 p.58–90、空間向量 p.91–115、空間中的平面與直線 p.116–140、條件機率與貝氏定理 p.141–153、矩陣 p.154–187。
3. 紀錄卡與教材進度圖共用同一份 3A～4A 對照資料，避免兩處結果不同。
4. 新增單元交界與末頁 p.187 的回歸測試。

更新資料夾：`gsat-study-tracker-v171.2.2-new-key-3A-4A-page-map-update`

## 驗證

- TypeScript 檢查通過。
- 304 項單元／回歸測試全部通過。
- 正式 Vite 建置通過。

本次不需要新增 Supabase migration，也不需要重新部署既有 Calendar Functions；重新部署 GitHub Pages 前端即可套用。

## Commit 建議

`fix(math): align New Key books 3A-4A pages with printed index`
