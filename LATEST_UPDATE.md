# 最新更新

版本：v171.6.27

## 修正 Calendar 合併卡片完成狀態還原

- Calendar 合併卡片同時保存畫面子項目與重建來源。經過 JSON／Cloud round-trip 後，兩者原本會成為互不相連的副本。
- 若使用者先修改分鐘數觸發儲存，再勾選某個子項目，畫面副本會顯示完成，但重建來源仍可能保持未完成；切換日期後就會還原。
- 現在每次從儲存空間讀取、複製或三方合併紀錄後，都會依穩定項目識別碼重新連結子項目與唯一來源。
- 完成勾選、完成日期與分鐘數會共同保留，不再因切換日期、背景 Cloud 合併或 Calendar 預設重建而消失。
- 非合併卡片及既有 Cloud 衝突保護流程不受影響。

## 驗證

- 新增單元測試，確認從 JSON 還原後的合併子項目會重新連到父項目的唯一來源。
- 新增 Chromium E2E：9/16 Calendar 數學合併卡先填 51.8 分鐘、完成日期改為 9/19，切至 9/19 再返回 9/16，勾選、日期與分鐘數皆保留。
- 406 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置及 15 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.27-grouped-completion-persistence-required-files`
- `gsat-study-tracker-v171.6.27-grouped-completion-persistence-full-project`

## Commit 建議

`fix(storage): preserve grouped completion across date navigation`
