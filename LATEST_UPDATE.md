# 最新更新

版本：v171.6.40

## 所有科目明細圓環改用高辨識度同色系色階

- 所有科目的單科明細圓環都改用該科主色附近的完整色階，不再只替完全相同的色相加黑或加白。
- 每個明細色票會小幅錯開色相，並搭配飽和度與明暗差異，提高相鄰圓環扇區及右側項目色點的辨識度。
- 色相偏移限制在同一色系範圍內，仍能一眼辨認目前所在的科目。
- 自然科點入後仍保留物理、化學、生物與地科各自的色系；同一分科有多個項目時，再套用該分科的同色系變化。
- 單一明細時維持原科目主色，不產生不必要的色差。

## 驗證

- 新增所有科目色票唯一性、同色系色相範圍、飽和度差異與明暗跨度測試。
- 完整單元／回歸測試、TypeScript 型別檢查、Vite 正式建置與 Chromium E2E 均已執行。

更新資料夾：

- `gsat-study-tracker-v171.6.40-summary-palette-required-files`
- `gsat-study-tracker-v171.6.40-summary-palette-full-project`

## Commit 建議

`feat(summary): refine subject-family drilldown colors`
