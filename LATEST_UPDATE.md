# 最新更新

版本：v171.2.3

## 本次一次完成

1. Calendar 標題不再必須以 `1`、`2`、`3A` 或 `4A` 開頭；標準備註含「講義版本＋冊別」即可辨識為數學。
2. 「新關鍵」冊別統一支援 `1-2冊`、`1～2`、`3A-4A冊`、`3A～4A`，內部正規化為 `1~2`、`3A~4A`。
3. Calendar 明確提供教材與冊別時，會更新舊卡片的預設教材；使用者手動改過的欄位仍受到保護。
4. 每小時同步後端也會依標準備註把新關鍵行程分類為數學，避免存成一般項目。

更新資料夾：`gsat-study-tracker-v171.2.3-calendar-new-key-reading-fix`

## 驗證

- 前端 TypeScript 檢查通過。
- 308 項單元／回歸測試全部通過。
- 正式 Vite 建置通過。
- 本機未安裝 Deno，因此完整 Edge Function 型別檢查會由部署流程使用固定版 Deno 執行；新增的純分類模組已由 Node 回歸測試驗證。

本次不需要新增 Supabase migration；需要重新部署 GitHub Pages 前端與 `google-calendar` Edge Function。

## Commit 建議

`fix(calendar): recognize New Key math materials and grouped books`
