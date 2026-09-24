# 最新更新

版本：v171.6.34

## 補齊 Azar 合併模組

- v171.6.33 已更新 Azar 測試，但 GitHub 尚缺少測試與 runtime 共同依賴的 `src/study/azarChapterCards.ts`，因此出現 `ERR_MODULE_NOT_FOUND`。
- 必要覆蓋包現在同時包含 Azar 合併來源模組、相關測試、外出日回歸測試及版本檔，不再只更新呼叫端。
- 模組負責將舊 Azar 小節進度安全搬入章節卡；本次只補齊 GitHub 檔案集合，不改變 Tracker 使用者行為。

## 驗證

- 424 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置與 17 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.34-ci-dependency-required-files`
- `gsat-study-tracker-v171.6.34-ci-dependency-full-project`

## Commit 建議

`fix(ci): include Azar chapter migration module`
