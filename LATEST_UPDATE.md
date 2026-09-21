# 最新更新

版本：v171.6.29

## 混合題與模考同日二選一

- 原本週五遇到混合題時會直接移除歷屆／模考限時作答，使用者無法自行決定。現在兩份原項目都保留，今日項目上方提供「混合題與作文／歷屆／模考限時作答」選擇。
- 未選擇前，兩項都不計入完成率；選擇後只顯示並統計所選項目，另一項仍保存在紀錄中，可隨時改選。
- 首頁學習時間、今日與週五結算完成率、週／月總結統一排除未選中的項目。
- 週五選模考時，週六安排批改與訂正；改選混合題後已填的週六訂正暫時隱藏但不刪除，改回模考即可恢復。
- 舊紀錄若已有一項完成或填寫資料，會沿用該項作為起始選擇。每日選擇沿用既有 JSON 紀錄與雲端合併，不新增資料表或 migration。

## 驗證

- 新增二選一、舊資料相容、完成率與時間排除，以及本機／Cloud payload 往返單元測試。
- 新增 Chromium E2E，涵蓋選擇、重新載入、週六訂正、改選後隱藏與恢復已填內容。
- 414 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置與 16 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.29-english-task-choice-required-files`
- `gsat-study-tracker-v171.6.29-english-task-choice-full-project`

## Commit 建議

`feat(schedule): choose between mixed writing and mock on collision days`
