# 最新更新

版本：v171.6.38

## 隱私權、條款與支援頁面中英文切換

- 隱私權政策、服務條款及使用者支援三個頁面都新增同頁「中文／English」切換，不需要另開一份英文頁面。
- 語言選擇會跨頁保存，並同步更新網址參數、頁面語言、瀏覽器分頁標題及頁面說明；英文瀏覽器首次開啟時會直接顯示英文。
- 隱私權政策加入完整英文資料處理說明，明確揭露網站未整合第三方 AI／ML API、不會自動把 Google Workspace API 資料傳送給 AI 服務，也不會用於訓練或改善通用 AI／ML 模型。
- 中英文隱私權政策都加入 Google API Services User Data Policy 的 Limited Use 遵循聲明。
- 本次只更新公開說明頁面，不變更 Google OAuth 權限範圍、Calendar 讀取流程或既有 Tracker 資料。

## 驗證

- 新增公開頁面結構、AI／ML 揭露及跨頁語言保存測試。
- 427 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置與 18 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.38-bilingual-legal-pages-required-files`
- `gsat-study-tracker-v171.6.38-bilingual-legal-pages-full-project`

## Commit 建議

`feat(legal): add bilingual privacy terms and support pages`
