# 最新更新

版本：v171.6.28

## 固定週五結算的完成日期截止點

- 原本只限制週五結算讀取週一至週五的排程，卻直接採用項目目前的完成狀態；若週末補勾平日項目，週五完成率便會被回溯改寫。
- 現在週五結算會同時限制排程範圍與實際完成日期，只接受截至該週週五已完成的內容。
- 週六、週日才勾選的平日項目不計入週五結算，但仍正常計入截至週日的本週結算。
- 截止條件已套用一般項目、Calendar 合併子卡、互動題、自然整合、延期與補做項目。
- 舊紀錄若沒有完成日期，仍以原排程日作為相容回退，不會因此遺失原有完成紀錄。

## 驗證

- 新增完成日期截止單元測試，確認週六完成不計入週五、但可計入週日快照。
- 新增 runtime 回歸測試，涵蓋一般項目、合併子卡與互動題，並確認週五／週日分別傳入正確截止日。
- 409 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置及 15 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.28-friday-settlement-cutoff-required-files`
- `gsat-study-tracker-v171.6.28-friday-settlement-cutoff-full-project`

## Commit 建議

`fix(metrics): freeze Friday settlement at Friday cutoff`
