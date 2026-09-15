# 最新更新

版本：v171.5.4

## 問題

- 原本使用 CSS 自動分欄；瀏覽器為了平衡每欄高度，仍把第一、第二項放到相鄰欄位。
- 因此前兩項水平位置相差約 110px，未符合「先直行」規則，E2E 正確判定失敗。

## 修正

- 依項目總數計算所需列數，每列最多對應四個直向欄位。
- 改用固定 Grid 的 `column` 排列，強制項目先由上往下，再向右換欄。
- 不再依賴瀏覽器自動平衡分欄，因此本機與 GitHub Actions 的結果一致。

## 瀏覽器測試

- 完整 `npm run test:e2e`：6/6 通過。
- 失敗的學習總結案例已通過，其他首頁、帳號、手機版、輸入與計時流程未受影響。

更新資料夾：`gsat-study-tracker-v171.5.4-summary-column-flow-fix`

## 驗證

- 333 項單元／回歸測試通過。
- TypeScript 型別檢查、Vite 正式建置與 Playwright 瀏覽器測試通過。

本次不需要新增 Supabase migration，也不需要重新部署 Edge Function；只需部署新版 GitHub Pages 前端。

## Commit 建議

`fix(summary): enforce vertical-first subject detail flow`
