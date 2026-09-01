# 最新更新

版本：v171.0.68

## 本次有更新的項目

- 本機 Study Record 的讀取、儲存、帳號範圍與舊資料解碼，已移到獨立 Local Repository。
- Supabase `study_records` 的讀取、版本查詢及儲存 RPC，已移到獨立 Supabase Repository；`legacy-app.ts` 不再直接操作這張資料表。
- 新增 Calendar → StudyTask application service；既有 Calendar parser 保留，解析後的路由、補做狀態、穩定識別碼及日期索引由應用層統一產生。
- 先為 `mathStudy`、`mathLecture`、`mathPractice` 三種頁碼型卡片建立 discriminated union 與型別守衛，其他卡片維持原格式，避免一次轉換造成大量風險。
- 新增 Repository、Calendar application service 與漸進卡片型別測試；完整測試目前共 137 項。

## 部署範圍

- 僅需重新部署前端；不需更新 Supabase Database 或 Edge Functions。

## Commit 建議

`refactor(core): extract record repositories and calendar task service`
