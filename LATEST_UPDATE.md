# 最新更新

版本：v171.0.89

## 本次修正

- 將 Edge Function CI 與正式部署合成一條有順序的 release workflow。
- Pull Request 只執行 233 項測試、前端 TypeScript、兩支 Edge Function Deno 檢查與 Vite build，不會碰正式環境。
- `main` 發布固定依序執行：migration dry-run、database migration、migration history 列表、兩支 Calendar Function、線上存活檢查、GitHub Pages。
- Database 或任一 Function 失敗時，Pages 不會部署，避免新版前端搭配舊版後端。
- Supabase CLI 固定為 `2.116.0`，setup action 固定在已知 commit，不使用浮動 `latest`。
- 正式發布會先檢查 GitHub Secrets；缺少憑證時顯示可操作的錯誤並在連線資料庫前停止。
- 專案 ID 以 `supabase/config.toml` 為準；若另設的 `SUPABASE_PROJECT_ID` 不一致，會阻止部署到錯誤專案。
- 關閉 release 的自動取消，避免新 commit 在 migration 或 Function 部署途中將工作強制中止。
- Pages 權限只交給最後的 Pages job；Supabase job 不取得 service role key、Google secret、Calendar token 或 cron secret。

## 首次 Actions 失敗修正

- Actions #106 的 233 項測試有 1 項失敗，原因是局部覆蓋不會刪除 GitHub 上三個舊時間戳 migration。
- 已刪除 `202608270001_v171_storage_calendar.sql`、`202608270002_google_calendar_client_id.sql`、`202608270003_fix_study_record_revision_ambiguity.sql`。
- 三個正式時間戳版本與最新 forward migration 均保留；此清理不刪除正式資料庫資料。
- 發布順序測試改為同時支援 LF／CRLF，避免 Windows clone 因換行格式產生假失敗。

## 第一次啟用

1. GitHub Environments 建立 `supabase-production`，建議只允許 `main` 並開啟正式部署確認。
2. 在該 Environment 的 Secrets 新增 `SUPABASE_ACCESS_TOKEN`。
3. 在該 Environment 的 Secrets 新增 `SUPABASE_DB_PASSWORD`。
4. `SUPABASE_PROJECT_ID` 是可選的防呆 Variable；若設定，值必須是 `arxbirgujbrtzhoficdf`。
5. 推送到 `main`，到 **Actions → Validate and release Tracker** 查看同一次完整發布。

既有 `VITE_GOOGLE_CLIENT_ID` 與每小時同步使用的 `CALENDAR_CRON_SECRET` 維持原設定。這次不需要重新連接或重新授權 Google Calendar。

## 安全行為

- workflow 先建好 Pages artifact，但一定等 Supabase 全部成功後才發布。
- 線上 smoke test 只確認兩支 Function 的預期公開回應，不登入、不讀取使用者行程，也不修改資料。
- 缺少 Secret、migration dry-run 失敗、正式 migration 失敗、Function 部署失敗或 smoke test 失敗，都會保留目前線上前端。
- 破壞性 schema 變更仍必須拆成相容的兩階段 migration；正式資料庫不會自動 reset 或回滾。

## 更新檔案

- 主專案已更新。
- `gsat-study-tracker-v171.0.89-ordered-release-update` 只包含本次變更檔案，不製作 ZIP，也不能單獨執行。

## 驗證

- 233／233 項測試通過，包含 3 項新的 release workflow 回歸測試。
- 前端 TypeScript 檢查與正式 Vite 建置通過。
- 使用 Deno `2.9.5` 對兩支 Edge Function 的 frozen lockfile 型別檢查均通過。
- 本機驗證已通過；GitHub Actions 會在本次提交重新驗證，並依序部署 Supabase 與 GitHub Pages。

## Commit 建議

`fix(migrations): remove obsolete timestamp aliases`
