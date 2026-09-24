# 最新更新

版本：v171.6.33

## GitHub CI 測試同步

- GitHub 上的主程式已使用 Azar 同章合併，但舊測試仍尋找已移除的 `calendarAzarSectionDef`，造成 CI 與實際功能版本不一致。
- Azar 測試已改驗證每章一張卡、相鄰頁碼合併及舊分項進度搬移，並補入 `azarGrammarChapterSummary` 測試相依。
- 同步外出日完成率與 Calendar 隔離 VM 測試，確保 GitHub 執行的測試集合與本機 v171.6.33 完全一致；使用者功能維持 v171.6.32 行為。

## 驗證

- 424 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置與 17 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.33-ci-test-sync-required-files`
- `gsat-study-tracker-v171.6.33-ci-test-sync-full-project`

## Commit 建議

`test(ci): sync release regression tests with current runtime`
