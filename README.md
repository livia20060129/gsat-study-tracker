# GSAT Study Tracker v171.1.0

個人版學測讀書進度 Tracker。此版本整合每日紀錄、Google Calendar 唯讀同步、Supabase 雲端備份、延期與合併項目、計時、完成率，以及教材進度視覺化。

> Google OAuth Client ID 由 Vite 的 `VITE_GOOGLE_CLIENT_ID` 在建置時注入。Client ID 是公開的應用程式識別碼；Google Client Secret、refresh token、access token 與排程密碼必須只留在 Supabase 或 GitHub Secrets，不可寫入原始碼。

## I. 使用方式

### 1. 第一次使用

1. 開啟 Tracker，先選擇日期與今日狀態。
2. 未登入時，紀錄保存在目前瀏覽器的訪客空間。
3. 需要跨裝置保存時，登入 Supabase 帳號。
4. 若瀏覽器內有舊版資料，登入後按「補上本機舊資料」再明確匯入；系統不會自動把無法判斷擁有者的舊資料放進帳號。
5. 需要 Calendar 排程時，展開「連線設定」，按「連接 Google Calendar」完成授權。

### 2. 每日紀錄

- 在「今日項目／本週項目」滑塊切換清單。
- 勾選完成，並依模板填寫進度、批改、訂正、錯因、頁碼、回次、單元或分數。
- 完成時間可手動輸入，也可切換為計時模式。
- 「儲存紀錄」會先保存目前日期到本機；登入後再安全地排入雲端同步。
- 切換日期前會先保存目前日期。登入時，每 10 分鐘也會保存並刷新雲端佇列，運行中的計時不會因此中斷。

### 3. Google Calendar

- 未加前綴的行程加入「今日項目」。
- `本週項目｜名稱` 加入「本週項目」。
- Calendar 補做或來源日期不是當日的項目，仍保留來源資訊與原本模板。
- 按「立即同步」可手動更新；設定完整時，GitHub Actions 也會每小時同步一次。
- Google Calendar 中刪除的行程會在下次同步時從 Tracker 的 Calendar 來源資料移除；使用者已填的其他本機紀錄不會任意被刪除。

### 4. 延期

1. 在可延期的主卡或子卡勾選延期。
2. 選擇同一週內、原日期之後的目標日。
3. 按「確認延期」後才真正建立目標日項目並改變完成率。
4. 每個目標日以 3 項為一般上限；超過時會顯示確認提示，舊延期不會被自動移除。

確認延期後，原日期的完成率分母會移除該項，例如 `2/5` 變成 `2/4`，不會把延期誤算成完成。目標日收到的補做項目則列入該日的「今日總項目完成率」。

### 5. 手動時間與計時

- 按「手動／計時」滑塊切換，不會改變卡片寬度。
- 計時顯示為「分:秒」；秒數合法範圍是 `00～59`，`00:60` 無效。
- 同一時間只允許一個項目計時。
- 按「完成並填入」後，結果換算為分鐘並四捨五入到小數點後一位，可覆蓋原先手填時間。
- 合併卡中的子卡也能分別計時或填入時間。

### 6. 完成率與統計

- **原訂今日項目完成率**：完成數 ÷ 尚未確認延期的原訂今日項目數。
- **今日總項目完成率**：完成數 ÷ 今日實際需要處理的原訂、補做與新增項目數；已確認延期者從原日期移除。
- 今日完成時間、今日完成數學頁數與本週完成數學頁數會依已完成紀錄計算。
- 星期五顯示週一至週五結算；星期日顯示全週結算與相較週五的百分點差異。
- 星期五、星期日可在完成率卡內切換「完成率／本週趨勢」。

### 7. 教材進度與排程 Prompt

- 頂部「教材進度圖」會開啟獨立頁面，可依國文、英文、數學、自然切換教材進度。
- 有完成、填寫時間或留下進度紀錄的教材單元會填色；未留下紀錄者保持空白。
- 頂部「排程建議prompt」會開啟 `gpt.prompt.html`，可把目前排程命名與 Calendar 備註規則帶到新的 AI 對話。

### 8. 匯出與匯入

- 匯出資料可作備份，也可供 AI 分析本週概況。
- 匯入採「解析 → 預覽 → 全部驗證 → 確認匯入」，離開輸入欄不會直接改動紀錄。
- 確認匯入前會建立可復原備份；多日同步會分別回報成功、衝突、失敗與尚未同步。

## II. 目前版本的重要功能及解說

### 1. 帳號隔離的本機資料

正式帳號與訪客使用不同的 localStorage namespace：

```text
study-v11:user:<supabase-user-id>:<YYYY-MM-DD>
study-v11:guest:<YYYY-MM-DD>
```

舊版 `study-v10.4:<YYYY-MM-DD>` 只視為無帳號歸屬的 legacy data。登入只切換到該使用者的資料空間，不會自動匯入舊資料。

### 2. 伺服器 revision 與衝突保護

`study_records` 使用伺服器產生的 `revision`，所有更新透過具基準版本的 `upsert_study_record()` 完成。手機與電腦不再用各自的裝置時間判斷哪份資料較新；基準版本不符時會保留兩端內容並顯示衝突。

本機同步狀態主要保存：

- `serverRevision`
- `serverUpdatedAt`（顯示與診斷用）
- `localDirty`
- `syncConflict`

### 3. Auth → Storage → UI → Background Sync

啟動時先取得 Supabase session，再選擇帳號或訪客資料空間，接著立即顯示本機快取。Study Records 與 Calendar 在背景讀取，不必等全部雲端歷史載完才看到畫面。

Study Records 使用 `updated_at + study_date` 的穩定游標分頁。第一次完成全量比對後保存帳號專屬 watermark，後續只讀取增量資料並保留重疊區間，降低雲端讀取時間與漏資料風險。

### 4. 每日期獨立儲存與最新紀錄佇列

每個日期有自己的 debounce 與寫入佇列。前一筆雲端寫入完成後才送下一筆，等待期間只保留最新完整紀錄，避免快速修改多個項目時共用舊 revision。即使網路緩慢，本機仍會先保存；手動儲存會重試未同步內容。

### 5. 不內建個人歷史資料

Production bundle 不再自動灌入個人歷史 seed。舊瀏覽器已存在的資料只能由使用者明確匯入，避免新帳號誤收到不屬於自己的紀錄。

### 6. Google Calendar 唯讀真同步

同步流程如下：

```text
Tracker
  → Google OAuth（calendar.readonly）
  → refresh token 僅存 Supabase server-side table
  → Edge Function 呼叫 Google Calendar API
  → calendar_tasks
  → Tracker 讀取並轉換為 StudyTask
```

使用的權限範圍只有：

```text
https://www.googleapis.com/auth/calendar.readonly
```

Tracker 不會寫入、修改或刪除 Google Calendar 原始行程。Calendar 解析與 Tracker 核心項目之間已有 application service 邊界，Google Event 不會直接成為永久 UI 合併卡。

### 7. 每小時 Calendar 同步

`.github/workflows/calendar-sync.yml` 在每小時第 7 分鐘呼叫 `google-calendar` Edge Function，同步所有已連線帳號；網站不需要保持開啟。設定缺漏、HTTP 失敗、回應格式錯誤或任一帳號同步失敗時，該次 Action 會標記失敗。

公開 repository 若長時間沒有活動，GitHub 可能暫停排程 workflow；可到 Actions 頁面重新啟用。請勿同時建立另一個相同頻率的排程，以免重複同步。

### 8. Calendar 標準備註、模板與刪除同步

新版行程建議使用逐欄標籤：

```text
【講義版本】教學講義
【冊別】1
【頁碼範圍】p.174–181
【重點】多項式函數與運算
【來源日期】8/31
【識別碼】math-polynomial-01
```

規則：

- `【冊別】` 只有數學使用。
- `【重點】` 可省略；Essential Grammar 不需要重點。
- `【頁碼範圍】` 與 `【單元進度】` 二選一；有效頁碼存在時優先。
- `【識別碼】` 用於跨日期重排的穩定識別；Google event key 仍用於刪除同步。
- 延期、Calendar 補做、合併與重新載入都必須保留原項目的專用模板。
- 同內容、同範圍的重複 Calendar 行程只建立一個統計項目；不同範圍依連續性合併或成為可獨立完成的子項目。

目前已支援數學、國文、英文、物理、化學、生物、地科、自然整合，以及 ACE Reading、Essential Grammar、大考英聽 A 攻略與主題百匯等專用教材格式。

### 9. 數學與教材進度

數學完成頁數依真正保存的來源項目計算，合併卡、Calendar 卡、延期卡及子卡都會展開計算；相同教材、冊別的重疊頁碼會去重。今日狀態為「外出」時，只取消固定排程，當日實際完成的自訂、Calendar 或延期數學頁數仍會計入。

目前 runtime 的數學完成頁面抽取、索引與計算來源是 `src/study/mathProgress.ts`。`mathProgressHistory.ts` 與 `weeklyMath.ts` 是尚未被 runtime 引用的歷史檔案，不應作為新功能的資料來源。

### 10. 合併卡、子卡與延期

- 連續頁碼可合併成一段，例如 `p.1–5`、`p.6–10` 形成 `p.1–10`。
- 中間有中斷或以回次、Test、Unit 計算時，使用同一主卡下的獨立子項目。
- 子項目可分別完成、計時、填時間與延期，並各自計入完成率。
- UI 合併卡由來源資料推導，不直接當成唯一的永久儲存單位；編輯會回寫 stable source item。

### 11. 完成率、週結算與慶祝回饋

兩個完成率都以項目數計算，不依分鐘加權。確認延期後從原日期分母移除，補做於目標日加入總項目分母。星期五與星期日顯示期間結算及趨勢。

「今日總項目完成率」首次達到 50% 時顯示小慶祝與「你已經完成一半了，繼續努力！」；首次達到 100% 時顯示「今日事今日畢！」。每個門檻每日只顯示一次，並尊重系統減少動態效果設定。

### 12. 計時與小數分鐘

計時以時間戳保存，重新整理或切換日期後可續計。按「完成並填入」時才換算為分鐘並保留一位小數；例如 15 秒為 `0.3` 分、1 分 29 秒為 `1.5` 分。計時不會自動勾選完成。

### 13. 安全匯入與固定前端依賴

JSON 匯入先預覽與完整驗證，使用者確認後才修改資料，並提供備份與逐日同步結果。`@supabase/supabase-js` 固定為 npm dependency `2.114.0` 並由 Vite 打包，不使用浮動 CDN 版本。

### 14. 視覺化與低飽和科目色

數學、國文、英文、自然與其他項目使用不同的低飽和色系；子卡使用更接近白色的同系表面與縮排，保留父子層級。完成率趨勢與教材進度圖都在既有版面或獨立頁面呈現，不把主畫面塞滿。

### 15. Supabase／Google 一次設定

以下設定只需在重建環境、第一次部署或 secrets 遺失時執行。

#### 15.1 Google Cloud Console

1. 建立或選擇 Google Cloud project。
2. 啟用 **Google Calendar API**。
3. 完成 OAuth 品牌、目標對象與資料存取設定。
4. 權限只加入 `calendar.readonly`。
5. 建立 **OAuth 2.0 Client ID → Web application**。
6. Authorized redirect URI 填入：

```text
https://arxbirgujbrtzhoficdf.supabase.co/functions/v1/google-calendar-callback
```

若 OAuth 仍在 Testing 模式，將實際使用的 Google 帳號加入 Test users。

#### 15.2 Vite 公開 Client ID

本機複製環境範例：

```powershell
Copy-Item .env.example .env.local
```

在 `.env.local` 設定：

```dotenv
VITE_GOOGLE_CLIENT_ID=你的-web-client-id.apps.googleusercontent.com
```

GitHub Pages 部署則到 Repo → Settings → Secrets and variables → Actions → **Variables** 新增同名 `VITE_GOOGLE_CLIENT_ID`。修改後必須重新執行部署，因為 Vite env 是建置時注入。

不要建立 `VITE_GOOGLE_CLIENT_SECRET`；所有 `VITE_` 變數都會公開在瀏覽器 bundle。

#### 15.3 Supabase Edge Function secrets

到 Supabase Dashboard → Edge Functions → Secrets，新增：

```text
GOOGLE_CLIENT_SECRET=<Google OAuth Client Secret>
GOOGLE_REDIRECT_URI=https://arxbirgujbrtzhoficdf.supabase.co/functions/v1/google-calendar-callback
APP_RETURN_URL=https://livia20060129.github.io/gsat-study-tracker/
GOOGLE_STATE_SECRET=<高熵隨機字串>
CALENDAR_CRON_SECRET=<另一組高熵隨機字串>
```

也可使用 Supabase CLI 的 `supabase secrets set NAME=value`。`.env` 與 secret 不可 commit；Supabase 設定完成後 secrets 會直接提供給 Edge Functions，不需要為了只改 secret 重新部署 Function。

#### 15.4 Database migrations

正式發布優先交給 GitHub Actions。手動處理時，於 repository root 依序執行：

```powershell
npx supabase@2.116.0 login
npx supabase@2.116.0 link --project-ref arxbirgujbrtzhoficdf
npx supabase@2.116.0 db push --dry-run
npx supabase@2.116.0 db push
npx supabase@2.116.0 migration list
```

所有 migration 都位於 `supabase/migrations/`，必須依歷史順序套用，不要只挑 README 中某一個檔案。Production 不可使用 `db reset --linked` 或 `--include-seed`。

#### 15.5 GitHub 正式發布憑證

到 Repo → Settings → Environments 建立 `supabase-production`，並新增 Environment secrets：

```text
SUPABASE_ACCESS_TOKEN=<Supabase Personal Access Token>
SUPABASE_DB_PASSWORD=<此專案的 Database Password>
```

建議只允許 `main` 部署。可另外在 Actions → Variables 設定：

```text
SUPABASE_PROJECT_ID=arxbirgujbrtzhoficdf
```

若 Variable 與 `supabase/config.toml` 不一致，發布會在碰觸資料庫前停止。

#### 15.6 每小時同步 Secret

在 GitHub Actions secrets 新增：

```text
CALENDAR_CRON_SECRET=<與 Supabase Edge Function 完全相同的值>
```

完成兩端設定後，到 Actions → **Hourly Google Calendar Sync** → Run workflow 手動驗收一次。

#### 15.7 正式發布順序

`.github/workflows/deploy.yml` 的順序是：

```text
測試／型別檢查／建置
  → migration dry-run
  → database migration
  → migration history 核對
  → 部署兩支 Calendar Edge Functions
  → 線上 smoke test
  → GitHub Pages
```

Pull Request 只驗證，不接觸正式 Supabase。只有 `main` 分支能執行正式發布；任何後端步驟失敗時，新的 Pages 前端不會先上線。

## III. 重大更新版本

這裡只列影響使用方式或整體架構的重大版本，不逐一羅列 v1～v171 的所有中間版。以下四個版本由實際開發紀錄確認，作為目前可靠的重大版本依據。

### v124｜Google Calendar 排程整合

原先即使已經安排好讀書進度，每天仍需重新輸入紀錄卡。為減少重複整理，開始將 Google Calendar 的排程資料整合進系統。

### v133｜Supabase 雲端同步

原先資料保存在單一裝置，換設備後便無法延續使用，因此加入 Supabase 雲端同步，使紀錄可以跨裝置保存與讀取。

### v169｜Google Calendar 每小時同步

原先修改 Google Calendar 排程後，紀錄卡內容不會同步更新，因此串聯 Google Calendar API，使用每小時同步機制，讓排程變動後不必再手動修改紀錄卡。

### v171｜將 Google OAuth 設定完善

測試時發現 Google Calendar 同步僅限自己的帳號使用。排查後確認原因是 Google OAuth 專案仍處於測試階段；完成隱私權政策、服務條款等設定並正式發布後，其他帳號也能正常連接與同步。

## IV. 此版本大更新（v171.x）

### v171.0｜Calendar、同步與資料可靠性

- Google Calendar 改為 OAuth 唯讀真同步，token 只存 server side。
- 建立 Calendar → StudyTask application service、Local／Supabase Repository 與部分 discriminated union。
- 加入穩定 revision、分頁同步、每日期寫入佇列、衝突保護與安全匯入。
- Calendar 重排、刪除、合併、延期與來源模板使用同一套穩定識別規則。
- CI/CD 依序驗證、套 migration、部署 Edge Functions，再發布 GitHub Pages。
- 新增計時、完成率雙指標、週結算、趨勢圖、教材模板與低飽和科目色。

### v171.1｜教材進度視覺化

- 新增獨立「教材進度圖」頁面。
- 依科目切換教材，以已保存的實際紀錄填色。
- 延期、Calendar 合併卡與子卡片會遞迴納入，不建立另一套進度資料。

## V. 此版本重要更新（v171.x.xx）

只收錄符合至少一項條件的更新：改變核心操作、資料計算、雲端／Calendar 可靠性、資料安全或正式部署。純文字、微小排版與單一樣式修正不列入。

| 版本 | 重要更新 |
| --- | --- |
| v171.1.0 | 新增獨立教材進度圖，依國文／英文／數學／自然與真實紀錄顯示完成狀態。 |
| v171.0.96 | 星期五／星期日新增本週完成率趨勢，與完成率共用欄位切換。 |
| v171.0.95 | 切換日期前先保存；登入後每 10 分鐘刷新雲端佇列且不中斷計時。 |
| v171.0.89 | 建立 Supabase database、Edge Functions 與 GitHub Pages 的順序化正式發布。 |
| v171.0.88 | Study Records、Calendar tasks 與每小時同步加入穩定游標分頁及後端可靠性保護。 |
| v171.0.87 | 補回每小時 Google Calendar 同步 workflow 與失敗驗證。 |
| v171.0.85 | 國文教材與英文主題／回次模板正式納入手動、Calendar、延期與重新載入流程。 |
| v171.0.82 | 自然科改為依各自 Calendar 行程判讀頁碼，避免同日不同科目互相覆蓋。 |
| v171.0.81 | 修正延期完成率：確認延期後從原日期分母移除，不再誤算成完成。 |
| v171.0.79 | JSON 匯入改為預覽、驗證、確認與備份；Supabase JS 改為固定 npm dependency。 |
| v171.0.65 | 新增可續計的手動／計時模式，並支援合併卡與子卡。 |
| v171.0.61 | 合併卡的所有可編輯欄位回寫實際來源紀錄，避免重新載入後消失。 |
| v171.0.60 | 同日期雲端寫入序列化，只保留等待中的最新完整紀錄。 |
| v171.0.47 | 建立 Calendar 標準備註欄位與穩定識別碼，頁碼優先於單元推算。 |
| v171.0.32 | 統一 Calendar 重排與 Tracker 延期的連續範圍合併及子項目規則。 |
| v171.0.27 | 延期改為選定日期後再確認，加入目標日容量與超額確認。 |
| v171.0.22 | Calendar 同內容去重並同步 Google 行程刪除結果。 |
| v171.0.3 | 修正 study record revision 欄位歧義，強化 RPC 與 RLS 權限。 |

## VI. 開發

建議使用 Node.js 22。安裝與驗證：

```powershell
npm ci
npm run typecheck
npm test
npm run typecheck:edge
npm run build
npm run dev
```

常用指令：

| 指令 | 用途 |
| --- | --- |
| `npm run dev` | 啟動 Vite 開發環境。 |
| `npm run typecheck` | 檢查前端 TypeScript。 |
| `npm test` | 執行 domain、storage、Calendar、UI 與 workflow 回歸測試。 |
| `npm run typecheck:edge` | 以 frozen lockfile 檢查兩支 Supabase Edge Functions。 |
| `npm run build` | 執行型別檢查並產生 production build。 |
| `npm run preview` | 預覽 production build。 |

開發原則：

- 新規則優先放在 typed module，不再擴大 `legacy-app.ts`。
- 永久資料、UI 合併 View Model 與外部 Calendar DTO 必須分開。
- 資料存取透過 Repository；domain 不直接依賴 DOM、Supabase 或 Google API。
- Calendar、延期、手動新增與重新載入必須共用同一套模板和 stable ID 規則。
- 新增或修正功能時，至少補對應 unit/regression test；涉及完整操作流程時再補 E2E。
- 依賴套件固定完整版本並提交 lockfile。

## VII. 專案結構

```text
.
├─ index.html                     # 每日 Tracker 主頁
├─ material.progress.html         # 獨立教材進度圖
├─ public/                        # Prompt、隱私權、條款與支援頁
├─ src/
│  ├─ main.ts                     # 前端入口
│  ├─ legacy-app.ts               # 尚待逐步抽離的 compatibility runtime
│  ├─ application/                # Calendar use case 與 Repository ports
│  ├─ domain/study/               # 漸進式 StudyItem 型別
│  ├─ infrastructure/storage/     # Local／Supabase Repository 與 Calendar reader
│  ├─ calendar/                   # Calendar 解析、頁碼優先與排程摘要
│  ├─ data/                       # 教材、書籍、頁碼及 fallback 排程資料
│  ├─ storage/                    # codec、同步、watermark、lock 與 queue
│  ├─ study/                      # 完成率、延期、合併、計時與進度規則
│  ├─ ui/                         # 已抽出的 UI view／action
│  ├─ material-progress-page.ts   # 教材進度頁 controller
│  ├─ material-progress.css       # 教材進度頁樣式
│  └─ styles.css                  # Tracker 主樣式
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/                 # 可重建 schema 的順序化 migration
│  └─ functions/
│     ├─ _shared/                 # Google Calendar、分頁、diff 與回應工具
│     ├─ google-calendar/         # 連線、讀取、同步與解除連線
│     └─ google-calendar-callback/# OAuth callback
├─ tests/                         # 主要回歸與純邏輯測試
└─ .github/workflows/
   ├─ deploy.yml                  # 驗證、Supabase 與 Pages 順序化發布
   └─ calendar-sync.yml           # 每小時 Calendar 同步
```

## VIII. 注意事項

1. `VITE_GOOGLE_CLIENT_ID` 可以公開，但 Client Secret、token、database password、Supabase access token 與 `CALENDAR_CRON_SECRET` 絕不可 commit。
2. 所有公開資料表必須同時檢查 Data API 權限與 RLS；`authenticated` 角色本身不等於資料所有權，policy 必須限制 `auth.uid()`。
3. 正式 database migration 只能向前修正。不要對 production 執行 `db reset --linked`，也不要用 seed 覆蓋正式資料。
4. GitHub Pages、Supabase Database 與 Edge Functions 不是同一個可回滾交易；正式發布必須維持 workflow 的既定順序。
5. 若 localStorage 不可永久保存，頁面關閉後資料可能消失；應依畫面警告處理，登入雲端也不能取代當下本機寫入是否成功的檢查。
6. Google Calendar 使用唯讀權限；Tracker 的「解除連線／刪除同步資料」不會刪除 Google Calendar 原始行程。
7. Calendar 行程盡量使用標準欄位和穩定 `【識別碼】`。修改日期可保留同一項目身分；改掉識別碼可能被視為刪除舊項目並新增新項目。
8. `legacy-app.ts` 仍保留 `@ts-nocheck`。新功能應持續抽到 application、domain、infrastructure、study 或 ui 模組，不應一次重寫整個應用。
9. README 後續固定使用本文件的八個章節；「III. 重大更新版本」只列架構里程碑，「V. 此版本重要更新」只列核心功能、資料、安全、同步或部署的重要變動。
