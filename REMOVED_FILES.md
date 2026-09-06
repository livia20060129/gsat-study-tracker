# 覆蓋更新時需移除的舊檔案

若是把此資料夾的內容覆蓋到舊版專案，請刪除以下三個舊 migration 檔案：

- `supabase/migrations/202608270001_v171_storage_calendar.sql`
- `supabase/migrations/202608270002_google_calendar_client_id.sql`
- `supabase/migrations/202608270003_fix_study_record_revision_ambiguity.sql`

它們已改用與正式 Supabase migration history 相同的時間戳檔名：

- `20260826195356_v171_storage_calendar.sql`
- `20260828041020_google_calendar_client_id.sql`
- `20260826225945_fix_study_record_revision_ambiguity.sql`

主專案 `gsat-study-tracker-v171` 內已完成這三項重新命名；此說明只供「局部覆蓋更新」時使用。
