# GSAT Study Tracker v171

個人版 Study Tracker。v171 把 v170 的資料安全重構與 Google Calendar 真同步合併成同一版。

> Google OAuth Client ID 由 Vite 的 `VITE_GOOGLE_CLIENT_ID` 在建置時注入；它是公開的應用程式識別碼，不是秘密。Google Client Secret、refresh token 與 access token 永遠只留在 Supabase server side。若任一端設定不完整，Calendar 區塊會顯示可採取行動的設定訊息，Tracker 其他功能與內建排程 fallback 仍可使用。

## v171 重點

### 1. localStorage 依帳號隔離

正式資料改用：

```text
study-v11:user:<supabase-user-id>:<YYYY-MM-DD>
```

未登入資料使用：

```text
study-v11:guest:<YYYY-MM-DD>
```

v170 以前的：

```text
study-v10.4:<YYYY-MM-DD>
```

只視為 legacy unscoped data。登入時不會自動匯入；只有按「補上本機舊資料」才會明確匯入目前帳號。

### 2. 登入不再自動解決 legacy conflict

登入只會切換到該 user 的本機 namespace、讀取雲端與 Calendar。`cloudMergeLocalMissing()` 只綁在「補上本機舊資料」按鈕，不存在登入自動呼叫路徑。

### 3. 啟動順序改為 Auth → Storage → UI → Background Sync

啟動先取得 Supabase session，再決定 `study-v11:user:<uid>:` 或 guest namespace。登入後會立即顯示該帳號隔離的本機快取，不再等待整批雲端歷史與 Calendar 都讀完才出現畫面。

Study Records 與 Calendar 會在背景平行讀取。Study Records 第一次仍會做完整 revision 比對；成功後保存每個帳號獨立的 server watermark，之後只增量讀取最近異動，並保留 2 分鐘重疊區間避免同步競爭造成缺口。待上傳資料改為背景佇列，MathProgressIndex 只在切換帳號時重建一次。

背景同步完成後，如果使用者正在輸入，Tracker 不會強制重繪打斷游標；切換日期時會自然套用最新資料。

`171.0.3` 另修正 `upsert_study_record` 的 `column reference "revision" is ambiguous`：資料表欄位一律以 relation alias 明確限定，RPC 改用 RLS 保護的 `security invoker`，並移除 anon／public 執行權限。

### 4. Study Record 不再依賴裝置時間判斷版本

`public.study_records` 新增 `revision bigint`。所有寫入透過：

```sql
public.upsert_study_record(study_date, payload, base_revision)
```

伺服器只有在 `base_revision` 與目前 revision 相同時才接受更新；成功後 revision + 1。手機／電腦時鐘不再決定誰比較新。

本機只保存：

- `serverRevision`
- `serverUpdatedAt`（僅顯示／診斷）
- `localDirty`
- `syncConflict`

### 5. 每日期獨立 cloud debounce

不再只有一個全站 timer。每個日期各有自己的 debounce timer，所以修改 8/26 不會取消 8/25 尚未送出的同步。

### 6. 移除 production seed 個人歷史資料

v170 內建的 `importedWeekData`／`importedV123ProgressData` 與自動灌入流程已從 production bundle 移除。舊瀏覽器已存在的 `study-v10.4:` 仍可由手動 migration 匯入。

### 7. Google Calendar API 真同步

新增 Supabase Edge Functions：

```text
supabase/functions/google-calendar
supabase/functions/google-calendar-callback
```

流程：

```text
Tracker
  → Google OAuth
  → refresh token 僅存 Supabase server-side table
  → Edge Function 呼叫 Google Calendar API events.list
  → calendar_tasks
  → Tracker 讀 calendar_tasks
```

使用 read-only scope：

```text
https://www.googleapis.com/auth/calendar.readonly
```

Google client secret／refresh token 不會出現在 GitHub Pages JavaScript。

Google OAuth Client ID 不寫死在原始碼，改從：

```text
VITE_GOOGLE_CLIENT_ID
```

讀取。前端會先檢查缺漏、範例值與格式；設定有效後才啟用「連接 Google Calendar」。OAuth state 會簽章保存此次連線使用的 Client ID，callback 完成後再將公開 Client ID 與連線一同存到 server-side table，供後續 refresh token 更新 access token。

目前 Calendar parser 已支援個人行事曆中的主要格式：

- `1｜多項式函數` 等數學排程
- `物理｜...`／`化學｜...`／`生物｜...`／`地科｜...`
- `自然整合｜...`
- `ACE Reading｜第 N 回＋訂正`
- `古今悅讀一百｜第 N 回＋訂正`／`第 N–M 回＋訂正`
- `英文文法｜...`
- `英文寫作測驗｜第 N 回：...`

數學事件若 description 沒寫頁碼，會依事件中的 `單元進度：x/y` 對應既有教材分段，不再以事件原本日期當作頁碼來源；因此 Calendar 搬日期仍能保留該段正確頁碼。

Calendar API 尚未成功連線或 `calendar_tasks` 尚無資料時，現有 hardcoded Calendar plan 暫時保留作 fallback，避免排程整批消失。

### 8. 每小時 Calendar 同步

`.github/workflows/calendar-sync.yml` 每小時觸發一次 server-side Calendar sync。網站不需要保持開啟。

### 9. 數學進度仍維持單一實作

只有：

```text
src/study/mathProgress.ts
```

負責 completed-page extraction、MathProgressIndex 與 UI pure calculation。v171 ZIP 不含 `mathProgressHistory.ts`／`weeklyMath.ts`。

### 10. UI

「其他補充」預設放大到約 6 行，並可垂直拖曳調整。

`171.0.5` 將 Cloud 與 Google Calendar 狀態合併成頁面頂部常駐的小型狀態列；登入、登出、讀取雲端、匯入舊資料、Calendar 同步與解除連線等設定操作，統一收進展開區域。收合時顯示「連線設定▼」，展開後顯示「連線設定＝」。錯誤、同步中、已連線與設定未完成會以不同顏色的狀態點呈現。

`171.0.6` 將每日完成度改為雙指標：

- **原定項目完成率**：維持既有規則，完成或已延期的原定項目都算已處理。
- **原定工作量完成率**：依排程頁數、Calendar 指定分鐘與項目類型的預設分鐘加權；只有實際完成才計入，延期不算已完成工作量。

週五另顯示週一至週五的「週五結算完成率」；週日顯示週一至週日的「本週結算完成率」，並標示相較週五結算的正負百分點。結算完成率是該期間「項目完成率」與「工作量完成率」的平均。

`171.0.7` 修正週五仍顯示「相較週五結算」的樣式問題：週五只顯示週五結算，週日才顯示比較。

`171.0.8` 將今日時間與數學統計排在上列，完成率雙指標移至下列，並移除多餘的「完成率雙指標」標題。

`171.0.9` 將原定工作量的分母定義為每日必做加上當日自行追加／補做項目；補做只影響工作量指標，不改變原定項目指標。每日必做勾選延期後，可指定加入同一週後續的星期二至星期日，既有未指定日期的延期仍以週日處理。

`171.0.10` 將「每日必做」改名為「今日項目」，新增可按日期查看的「本周項目」總覽，並在英文書目加入全書 115 Unit 的 `Essential Grammar in Use`。

`171.0.11` 將 `Essential Grammar in Use` 改為獨立的 Unit 欄位，不再使用頁碼欄位。Google Calendar 標題或說明中的 `Unit 12`、`Unit 12–14`、`Unit 12、14` 會同步到本周項目，且每個 Unit 建立為一個可獨立完成的今日項目。

`171.0.12` 將原定工作量完成率改為項目數比例，不再依分鐘或頁數加權。分母是今日項目加上今日補做項目；分子只計實際勾選完成，延期不算完成工作量。`Essential Grammar in Use` 每個 Calendar Unit 各算一項。

`171.0.13` 將 Google Calendar 項目分流到獨立清單：`Essential Grammar in Use` 預設進入「本周項目」；既有日期型學習排程預設進入「今日項目」。Calendar 標題可使用 `今日項目｜項目名稱` 或 `本週項目｜項目名稱` 明確指定位置；本周項目可直接勾選完成，不會重複出現在今日項目。

---

# Supabase／Google 一次設定（重建環境或尚未設定 secrets 時）

## 1. 套用 migration

先登入 Supabase CLI，於 repo root 執行：

```bash
supabase link --project-ref arxbirgujbrtzhoficdf
supabase db push
```

migration 位於：

```text
supabase/migrations/202608270001_v171_storage_calendar.sql
supabase/migrations/202608270002_google_calendar_client_id.sql
```

它會：

- 替 `study_records` 加入 `revision`
- 建立 `upsert_study_record()`
- 建立 `google_calendar_connections`
- 替既有 Calendar connection 增加公開的 `client_id`
- 補強 `calendar_tasks`

## 2. Google Cloud Console

建立／選擇 Google Cloud project：

1. Enable **Google Calendar API**
2. 設定 OAuth consent screen
3. 建立 **OAuth 2.0 Client ID → Web application**
4. Authorized redirect URI 填：

```text
https://arxbirgujbrtzhoficdf.supabase.co/functions/v1/google-calendar-callback
```

Google OAuth 若仍在 Testing 模式，記得把實際 Google 帳號加入 Test users。

## 3. 設定 Vite 的公開 Client ID

OAuth Client ID 是公開識別碼，可安全出現在瀏覽器；OAuth Client Secret 才是必須保密的憑證。

本機開發先複製：

```bash
cp .env.example .env.local
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env.local
```

再把 `.env.local` 改成：

```dotenv
VITE_GOOGLE_CLIENT_ID=你的-web-client-id.apps.googleusercontent.com
```

`.env.local` 已由 `.gitignore` 排除。不要建立 `VITE_GOOGLE_CLIENT_SECRET`；所有 `VITE_` 值都會公開進 browser bundle。

GitHub Pages 正式部署時，到 Repo → Settings → Secrets and variables → Actions → **Variables** 新增：

```text
VITE_GOOGLE_CLIENT_ID=<同一個 Web OAuth Client ID>
```

`deploy.yml` 會把這個 repository variable 提供給 Vite build。修改 variable 後必須重新執行 workflow，因為 Vite env 是建置時設定。

## 4. 設定 Edge Function secrets

建立自己的高熵字串作為 `GOOGLE_STATE_SECRET` 與 `CALENDAR_CRON_SECRET`，不要 commit 到 repo。

```bash
supabase secrets set \
  GOOGLE_CLIENT_SECRET='你的 Google OAuth client secret' \
  GOOGLE_REDIRECT_URI='https://arxbirgujbrtzhoficdf.supabase.co/functions/v1/google-calendar-callback' \
  APP_RETURN_URL='https://livia20060129.github.io/gsat-study-tracker/' \
  GOOGLE_STATE_SECRET='隨機長字串' \
  CALENDAR_CRON_SECRET='另一組隨機長字串'
```

`GOOGLE_CLIENT_ID` 不再是 Supabase 必要 secret；Client ID 由設定完成的前端送入 auth flow，Client Secret 則只由 callback／token refresh 在伺服器端使用。

## 5. Deploy Edge Functions

```bash
supabase functions deploy google-calendar --project-ref arxbirgujbrtzhoficdf
supabase functions deploy google-calendar-callback --project-ref arxbirgujbrtzhoficdf
```

## 6. GitHub Actions Secrets

Repo → Settings → Secrets and variables → Actions，新增：

```text
Variable: VITE_GOOGLE_CLIENT_ID=<Google Web OAuth Client ID>
Secret:   SUPABASE_PROJECT_URL=https://arxbirgujbrtzhoficdf.supabase.co
Secret:   CALENDAR_CRON_SECRET=<與 Supabase secret 相同>
```

若原本已用 Actions secret 保存 `VITE_GOOGLE_CLIENT_ID` 也可繼續使用，workflow 會以 repository variable 優先。Client ID 本身不是敏感資料，建議使用 Variable。

其餘兩個是每小時同步 workflow 使用的 secrets：

```text
SUPABASE_PROJECT_URL=https://arxbirgujbrtzhoficdf.supabase.co
CALENDAR_CRON_SECRET=<與 Supabase secret 相同>
```

之後 `Hourly Google Calendar Sync` 會在每小時第 7 分鐘觸發同步，也可從 Actions 手動 Run workflow。

---

# 使用方式

第一次部署 v171 後：

1. 登入 Study Tracker
2. 舊版 localStorage 不會自動灌入目前帳號
3. 若需要舊本機資料，明確按「補上本機舊資料」
4. 在 Google Calendar 區塊按「連接 Google Calendar」
5. 完成 Google OAuth
6. callback 會立即同步一次 Calendar
7. 回 Tracker 後可按「立即同步」測試
8. 之後每小時自動同步

如果 `VITE_GOOGLE_CLIENT_ID` 未設定或仍是 `.env.example` 的範例值，「連接 Google Calendar」會停用並直接說明要補的設定，不會再送出必然失敗的 OAuth request。已連線帳號仍可載入 `calendar_tasks`；舊連線若尚未保存 `client_id`，請在套用新 migration／部署 Functions 後解除連線並重新連接一次。

---

# 開發

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## 專案結構

```text
src/
├─ main.ts
├─ legacy-app.ts
├─ types.ts
├─ config/
│  └─ googleCalendar.ts
├─ calendar/
│  └─ calendarBridge.ts
├─ data/
│  ├─ mathCalendar.ts
│  └─ naturalCalendar.ts
├─ storage/
│  ├─ local.ts
│  ├─ recordSync.ts
│  └─ syncWatermark.ts
├─ study/
│  ├─ completionMetrics.ts
│  ├─ defer.ts
│  └─ mathProgress.ts
├─ items/
│  └─ naturalIntegration.ts
└─ ui/
   └─ dom.ts

supabase/
├─ config.toml
├─ migrations/
│  ├─ 202608270001_v171_storage_calendar.sql
│  ├─ 202608270002_google_calendar_client_id.sql
│  └─ 202608270003_fix_study_record_revision_ambiguity.sql
└─ functions/
   ├─ _shared/googleCalendar.ts
   ├─ google-calendar/index.ts
   └─ google-calendar-callback/index.ts
```

## 注意

`legacy-app.ts` 仍是舊 UI／業務邏輯 compatibility runtime，因此尚保留 `@ts-nocheck`。v171 已把版本判定、storage namespace、數學進度與 Calendar parser／server integration 放到 typed module 或 server function；後續版本再逐區拆除剩餘 legacy UI code。
