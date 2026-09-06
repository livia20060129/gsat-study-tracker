# 最新更新

版本：v171.0.87

## 本次修正

- 新增缺少的 `.github/workflows/calendar-sync.yml`。
- 每小時第 7 分鐘呼叫 Supabase `google-calendar` Edge Function 的 `sync-all`，網站關閉時仍可同步。
- 保留 `workflow_dispatch`，可在 GitHub Actions 手動執行驗收。
- workflow 不取得 GitHub token 權限，也不使用 Supabase service role key、Google Client Secret 或 refresh token。
- `CALENDAR_CRON_SECRET` 只從 GitHub Actions Secrets 讀取，沒有硬寫在程式碼。
- 設定缺漏、網路／HTTP 錯誤、回應格式錯誤或任一帳號同步失敗，都會讓 Action 明確失敗。
- 公開 log 只顯示同步總數與失敗數，不輸出使用者識別碼或完整伺服器回應。
- 首頁說明改為只有完成 GitHub Actions 設定後才宣稱每小時同步，避免設定未完成時誤導。

## 防止再次遺失

- 新增 `hourlyCalendarWorkflow.test.ts`，確認 workflow 仍包含每小時排程、手動觸發、`sync-all`、secret header 與個別失敗判定。
- 正式部署 workflow 已經會執行完整 `npm test`，因此未來若排程檔被移除或關鍵設定遭破壞，部署測試會直接失敗。

## 套用方式

- 主專案已更新；`gsat-study-tracker-v171.0.87-update` 只包含本次變更檔案，不製作 ZIP。
- 將更新資料夾內容依原路徑合併覆蓋到已套用 v171.0.86 的完整專案，再推送至 GitHub。更新資料夾不能單獨執行。
- Supabase Database 與 Edge Function 程式碼不需重新部署，也不需重新授權 Google Calendar。
- 目前正式 Supabase 專案尚缺 `CALENDAR_CRON_SECRET`；必須在 Supabase Edge Function Secrets 與 GitHub Actions Secrets 新增完全相同的高熵值。
- 設定後到 **Actions → Hourly Google Calendar Sync → Run workflow** 手動驗收一次；成功後才算完成正式啟用。

## 驗證

- TypeScript 檢查與正式 Vite 建置通過。
- 全部 217 項測試通過，包含本次新增的 3 項 workflow 回歸測試。
- 已以唯讀方式確認正式 Supabase 專案目前沒有 `CALENDAR_CRON_SECRET`，所以 workflow 推上 GitHub 後仍需完成兩端 secret 設定。
- 未修改正式 Calendar 資料，尚未把 workflow 推送到 GitHub 正式分支。

## Commit 建議

`fix(calendar): restore secure hourly sync workflow`
