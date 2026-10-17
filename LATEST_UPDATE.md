# 最新更新

版本：v171.6.67

日期：2026-10-17（自用版）

## 修正 WebKit 連線設定測試誤點

- CI 的實際錯誤是等待 `is-closing` 逾時，而 details 始終維持 open；不是總結頁建置失敗，也不是 500 kB 建置警告造成。
- 原測試以整條 summary 作為點擊目標，其中央位置可能落在內嵌的「儲存紀錄」按鈕。程式本來就會讓儲存按鈕只儲存、不收合，因此出現面板維持開啟的結果。
- 在本機 WebKit 將原生儲存按鈕字級設為 16px 後，已重現 summary 中央命中 `saveBtn`；點擊後按鈕變為「儲存中…」，details 仍為 `open`、class 為 `connection-dock`，與失敗紀錄一致。
- 連線設定相關測試改為明確點擊 `.connection-settings-toggle`，不再依賴整條狀態列的中央落點。
- 新增共用的瀏覽器內動畫影格觀測。事件發生時即保存 opening／closing、幾何位置及捲動值，直到動畫結束；不再依賴跨程序查詢短暫 class 或固定等待 120 毫秒。
- 保留原有嚴格的位置及捲動檢查，收合期間逐影格確認錨點未移動，並確認內容確實縮回後才關閉。
- CI 失敗時上傳 `playwright-diagnostics`，保留測試報告、截圖及 trace 7 天，方便取得後續失敗證據。
- 本次僅修改測試、診斷工作流程與版本文件。正式使用者端動畫、儲存行為及資料格式不變；包含 v171.6.66 的完成項目清單。

## 驗證

- 477 項單元測試全部通過。
- 應用程式型別檢查、動畫觀測 helper 的獨立型別檢查及正式建置通過。
- Chromium／WebKit 的手機錨點與桌面收合測試重複驗證 24 次，全部通過；手機測試包含 16px 原生按鈕字級。
- 完整 Chromium／WebKit 瀏覽器測試 78 項全部通過。
- 透過 verification 流程追查點擊落點與動畫狀態，先重現原失敗，再確認精確控制項點擊及動畫過程；未放寬位置容忍值、增加逾時或加入重試掩蓋失敗。
- 以上為本機驗證結果；套用後仍需由 GitHub Actions 重新執行 Linux CI。

## 覆蓋方式

- 已套用 v171.6.66：使用同版更新資料夾內的「必要覆蓋檔案」，依原路徑覆蓋至專案根目錄。
- 務必同時覆蓋 `e2e/tracker.spec.ts` 與新增的 `e2e/helpers/connectionMotion.ts`，並包含 `.github/workflows/deploy.yml`，不可只更新單一測試檔。
- 尚未套用前版或需要完整來源：使用「完整專案覆蓋版」，保留既有 .env.local 等本機設定。
- 兩種資料夾擇一使用，皆不包含依賴套件、建置產物或本機秘密設定。

## Commit 建議

`test(e2e): target connection toggle and capture motion frames`
