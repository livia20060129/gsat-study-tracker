# 必須移除的舊 migration

局部覆蓋不會自動刪除舊檔。套用 v171.0.89 時，請確認下列三個檔案已從 `supabase/migrations/` 移除：

```text
supabase/migrations/202608270001_v171_storage_calendar.sql
supabase/migrations/202608270002_google_calendar_client_id.sql
supabase/migrations/202608270003_fix_study_record_revision_ambiguity.sql
```

保留下列正式版本：

```text
supabase/migrations/20260826195356_v171_storage_calendar.sql
supabase/migrations/20260826225945_fix_study_record_revision_ambiguity.sql
supabase/migrations/20260828041020_google_calendar_client_id.sql
supabase/migrations/20260906173903_harden_sync_pagination_and_record_upsert.sql
```

刪除的三個檔案只是舊時間戳的重複 migration；不會刪除 Supabase 正式資料。
