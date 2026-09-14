# GSAT Study Tracker

目前版本：**v171.2.3**

個人版學測讀書追蹤器，整合每日／每週項目、Google Calendar 唯讀排程、Supabase 跨裝置同步、計時、完成率與教材進度。

## I. 使用方式

1. 開啟 Tracker，選擇日期後填寫今日狀態與各項進度。
2. 每張可計時卡片可點一下「手動／計時」切換；計時顯示分：秒，完成後換算為分鐘並四捨五入到小數點後一位。
3. 勾選項目、修改欄位或輸入文字時，內容會先保存到目前瀏覽器；重要的勾選、延期與刪除會立即保存，連續打字會短暫合併後再保存，減少手機卡頓。
4. 按「儲存紀錄」後，按鈕會分別顯示：
   - `已存本機 ✓`：本機已安全保存，但 Cloud 尚未完成。
   - `Cloud 已同步 ✓`：Supabase 已確認寫入完成。
   - `同步失敗`：本機仍保留，恢復網路後會立即重試。
5. 登入 Cloud 後，可在不同裝置讀取同一帳號的紀錄；同時開啟多個分頁時，系統會先比較再上傳。
6. 整張自行新增卡片刪除前會再次確認；單字列、雜誌列與其他小項目刪除後可在 8 秒內按「復原」。
7. 「匯出與匯入」可先預覽 JSON，確認後才寫入，並可復原上次匯入。

## II. 目前版本的重要功能及解說

### 1. 今日項目與本週項目

- 今日／本週使用滑塊切換。
- 同科目相鄰排列，科目使用低飽和淡色區分。
- Calendar 頁碼範圍優先於單元推算；沒有頁碼範圍時才使用單元進度。
- 相同連續範圍可合併；中斷範圍或不同回次保留為同一大卡中的獨立子項目。

### 2. 延期與完成率

- 延期必須選擇目標日並按「確認延期」後才生效。
- 每個目標日預設最多 3 項，超過時會再次詢問。
- 確認延期後，原訂今日項目與今日總項目的分母都會減少一項，不會把延期誤算成完成。
- 子卡片可分別延期、完成、手動填入時間或計時。

### 3. Google Calendar 唯讀整合

- 使用 `calendar.readonly` 讀取行程，不會修改或刪除 Google Calendar 原始資料。
- 無特殊前綴的行程加入今日項目；`本週項目｜名稱` 加入本週項目；Calendar 補做仍加入今日項目。
- 同步包含新增、修改與刪除，避免已刪除的 Calendar 行程留在 Tracker。
- GitHub Actions 可每小時呼叫後端同步，網站不必保持開啟。

### 4. Local-first 與 Supabase 雲端同步

- 所有輸入先保存本機，再排入 Cloud 上傳。
- Cloud 狀態會顯示「同步中」、「待同步 X 天」、「已同步」或「同步失敗」。
- 網路恢復時立即掃描待同步日期並重試，不必等待下一個 10 分鐘週期。
- 雲端資料抵達時若使用者正在輸入，不會強制重畫；失焦後會安全合併，亦可按「立即套用」。
- 同一日期在多分頁／多裝置修改時，以穩定項目 ID 與共同基準交叉比對；不同欄位可合併，同一欄位衝突則保留兩邊並提示處理。

### 5. 帳號復原

- 支援忘記密碼、從 Email 回到 Tracker 設定新密碼，以及重寄註冊驗證信。
- 密碼重設回站網址必須先加入 Supabase Auth 的 Redirect URLs，否則信件能寄出但無法正確回到 Tracker。

### 6. 時間與視覺化

- 今日完成時間、今日數學頁數、本週數學頁數與完成率集中顯示。
- 各科完成時間以圓環圖呈現，環中顯示國／英／數／自／社，指向或點擊後顯示分鐘與占比。
- 週五顯示週一至週五完成率趨勢；週日顯示完整一週。
- 教材進度圖另頁開啟，按科目切換並用深淺交錯長條顯示進度。

### 7. 資料安全

- 無法解碼的本機紀錄不會被當成空白覆蓋，可先下載原始備份再用雲端版本修復。
- JSON 匯入採「解析 → 完整驗證 → 預覽 → 確認 → 寫入」，逐日回報本機與 Cloud 結果。
- 清空欄位、刪除項目與新增內容皆保留明確變更語意，避免同步時舊資料復活。

### Supabase／Google 一次設定

#### A. Google Cloud

1. 啟用 Google Calendar API。
2. 建立 OAuth 2.0 Web application。
3. OAuth redirect URI 設為：
   `https://arxbirgujbrtzhoficdf.supabase.co/functions/v1/google-calendar-callback`
4. OAuth consent screen 使用唯讀 Calendar scope。

#### B. Vite 前端環境變數

在 GitHub repository 的 **Settings → Secrets and variables → Actions → Variables** 新增：

```text
VITE_GOOGLE_CLIENT_ID=你的 Google OAuth Web Client ID
```

Client ID 是公開識別碼，不是密碼；仍不可把個人專案值直接寫死在原始碼。可參考 `.env.example`。

#### C. Supabase Edge Function secrets

```text
GOOGLE_CLIENT_ID=同一個 Google OAuth Client ID
GOOGLE_CLIENT_SECRET=Google OAuth Client Secret
GOOGLE_REDIRECT_URI=https://arxbirgujbrtzhoficdf.supabase.co/functions/v1/google-calendar-callback
GOOGLE_STATE_SECRET=高熵隨機字串
APP_RETURN_URL=https://livia20060129.github.io/gsat-study-tracker/
CALENDAR_CRON_SECRET=32 字元以上隨機字串
```

#### D. Supabase Auth URL Configuration

在 **Authentication → URL Configuration** 設定：

```text
Site URL
https://livia20060129.github.io/gsat-study-tracker/

Redirect URLs
https://livia20060129.github.io/gsat-study-tracker/
https://livia20060129.github.io/gsat-study-tracker/**
```

忘記密碼與 Email 驗證都會回到上述正式網址。

#### E. GitHub Actions 部署

Actions secrets：

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_DB_PASSWORD
CALENDAR_CRON_SECRET
```

Actions variable 或 secret：

```text
SUPABASE_PROJECT_ID=arxbirgujbrtzhoficdf
VITE_GOOGLE_CLIENT_ID
```

推送到 `main` 後，流程會依序執行單元測試、Edge Function 型別檢查、真實瀏覽器 E2E、正式建置、Supabase migration／functions 部署，最後發布 GitHub Pages。

## III. 重大更新版本

### v124｜Google Calendar 排程整合

原先即使已經安排好讀書進度，每天仍需重新輸入紀錄卡。為減少重複整理，開始將 Google Calendar 排程資料整合進系統。

### v133｜Supabase 雲端同步

原先資料保存在單一裝置，換設備後無法延續，因此加入 Supabase 雲端同步，使紀錄可跨裝置保存與讀取。

### v169｜Google Calendar 每小時同步

原先修改 Google Calendar 排程後，紀錄卡不會同步更新，因此串聯 Google Calendar API 與每小時同步機制，排程變動後不必再手動修改紀錄卡。

### v171｜Google OAuth 與正式使用設定完善

測試時發現 Calendar 同步只限測試帳號。完成 OAuth consent、隱私權政策、服務條款、正式網域與發布設定後，其他獲准使用者也能連接與同步。

## IV. 此版本大更新（v171.x）

- 將 Calendar 解析、頁碼優先、合併、延期、完成率、計時與儲存規則逐步移出單一 runtime，建立可測試模組。
- 將本機與 Supabase 存取隔離為 Repository，加入 revision、共同基準、跨分頁鎖與欄位級合併。
- 增加完成率趨勢、教材進度與各科時間圓環圖。
- Calendar 備註統一支援講義版本、冊別、頁碼範圍／單元進度、來源日期、重點與識別碼。

## V. 此版本重要更新（v171.x.xx）

- **v171.1.0**：完成率趨勢與教材進度圖正式加入。
- **v171.1.14**：多分頁上傳前交叉比對，保留兩邊有紀錄的內容。
- **v171.1.19**：英文訂正文字改用穩定列 ID，避免輸入中的文字重複保存。
- **v171.1.20**：加入三方合併與刪除墓碑語意，避免刪除項目被同步復活。
- **v171.1.21**：損壞本機資料可備份與修復，匯入驗證加深。
- **v171.1.22**：所有可計時子項目都能獨立計入讀書時間。
- **v171.2.0**：加入刪除確認／小項目 Undo、完整帳號復原、精確 Cloud 狀態、斷線立即重試、輸入安全合併、輸入 debounce、手機 bottom sheet 與 Playwright E2E。
- **v171.2.1**：依紙本目錄確認「新關鍵 1～2 冊」七個單元的頁碼邊界，末頁固定為 p.191，並讓紀錄卡與教材進度圖共用同一份對照資料。
- **v171.2.2**：依紙本目錄確認「新關鍵 3A～4A 冊」七個單元的頁碼邊界，末頁固定為 p.187，並納入共用對照資料。
- **v171.2.3**：修正 Calendar 無法辨識「新關鍵」數學排程；支援 `1-2冊`、`1～2`、`3A-4A冊`、`3A～4A`，並將標準備註的教材、冊別與頁碼安全套用到數學卡片。

## VI. 開發

需求：Node.js 22。

```bash
npm ci
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

本機環境設定：

```bash
copy .env.example .env.local
```

Edge Functions 型別檢查另需 Deno：

```bash
npm run typecheck:edge
```

## VII. 專案結構

```text
src/
├─ application/       Calendar → StudyTask 等流程
├─ calendar/          Calendar parsing 與排程摘要
├─ data/              教材、章節與頁碼資料
├─ storage/           Local／Supabase Repository、同步與 migration
├─ study/             完成率、延期、合併、計時等純邏輯
├─ ui/                可重用 UI renderer
├─ legacy-app.ts      尚在漸進拆分的相容性 runtime
├─ main.ts
└─ styles.css
supabase/
├─ functions/         Google Calendar OAuth／同步
└─ migrations/        資料庫版本
tests/                單元與回歸測試
e2e/                  Playwright 真實瀏覽器流程
.github/workflows/    驗證、Supabase 與 GitHub Pages 部署
```

## VIII. 注意事項

- 不要把 `GOOGLE_CLIENT_SECRET`、`GOOGLE_STATE_SECRET`、`CALENDAR_CRON_SECRET`、Supabase service role key 或資料庫密碼放進前端或 Git。
- Supabase publishable key 與 Google OAuth Client ID 是前端公開識別碼，但應由既定設定流程管理。
- 瀏覽器若禁止 persistent storage，Tracker 會顯示警告；此時不要把「已暫存」理解成關頁後仍一定存在。
- Google Calendar 只讀 scope 不代表同步後的 Tracker 副本不含個人資料；資料刪除與隱私權政策仍需和實際行為一致。
- 建置若只出現 JavaScript chunk size 警告，不會阻止發布；後續可繼續拆分 `legacy-app.ts` 以降低載入與修改風險。
