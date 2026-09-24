# 最新更新

版本：v171.6.35

## GitHub 完整內容校準

- 已直接下載 GitHub `main`，逐檔比較所有來源、測試、公開資源、Supabase 與設定檔，並忽略 Windows／Linux 換行差異。
- GitHub 唯一仍落後的有效內容是 `src/data/azarGrammar.ts`、`src/study/materialProgress.ts` 與 `tests/materialProgress.test.ts`；其餘目前使用中的檔案與本機一致。
- 補入 `azarGrammarChapterSummary` 匯出，並同步章節合併卡的教材進度判斷與測試。本次修正版本錯置，不改變 v171.6.32 的外出日行為。
- Prompt 回歸測試改為同時接受 Windows CRLF 與 Linux LF，確保從 GitHub 新下載後也能得到相同結果。

## 驗證

- 424 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置與 17 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.35-github-alignment-required-files`
- `gsat-study-tracker-v171.6.35-github-alignment-full-project`

## Commit 建議

`fix(ci): align Azar data and progress modules with tests`
