# GSAT Study Tracker v171

個人版 Study Tracker。v171 把 v170 的資料安全重構與 Google Calendar 真同步合併成同一版。

> Google OAuth Client ID 由 Vite 的 `VITE_GOOGLE_CLIENT_ID` 在建置時注入；它是公開的應用程式識別碼，不是秘密。Google Client Secret、refresh token 與 access token 永遠只留在 Supabase server side。若任一端設定不完整，Calendar 區塊會顯示可採取行動的設定訊息，Tracker 其他功能與內建排程 fallback 仍可使用。

## v171 重點

### 0. v171.0.81 延期完成率與刪除按鈕位置

「原訂今日項目完成率」與「今日總項目完成率」都只計入實際完成且尚未延期的項目。確認延期後，該項從原日期的分母移除，不增加完成數：例如 `2/5` 變為 `2/4`，不是 `3/5`。補做在目標日納入今日總項目分母，再次延期則從該日移除；取消延期後恢復計入。未確認的延期選擇不影響計算，改選目標日不會重複扣除。週五／本週結算沿用修正後的兩項統計，平均公式不變；全部項目排除時顯示 `0/0`、`0%`。

自行新增主卡、互動題、雜誌、回補及整理子卡的「刪除此筆」統一移到各卡片最下方靠左；保留原有的刪除權限、計時停止及儲存行為，系統鎖定項目與最後一筆雜誌仍依原規則限制刪除。

### 0. v171.0.80 新增「大考英聽A攻略」

英文書籍新增「大考英聽A攻略」，沿用 ACE Reading 的進度、批改、訂正與錯因模板，範圍改為 `Test 1～10`。Google Calendar 可從標題或標準備註中的 `Test N`／`Test N-M` 建立對應卡片；不同 Test 會收在同一張主卡的獨立子項目中。Calendar 重排、Tracker 延期與重複延期後仍會保留書名、Test、完成狀態、時間與完整模板。匯出摘要也會使用 `Test N`，不會誤寫成「第 N 回」。

### 0. v171.0.79 安全匯入與 Supabase 前端打包

JSON 匯入改為先完整驗證與預覽，使用者按下「確認匯入」後才會修改資料；離開欄位與 `Ctrl+Enter` 都不再直接匯入。確認前會保存可復原備份，本機多日寫入失敗會回復本次變更，雲端則逐日回報成功、衝突、失敗與未同步。既有同步衝突不會被匯入流程清除。Supabase JS 改為固定版本 npm dependency，由 Vite 隨前端打包，不再使用浮動 CDN script。

### 0. v171.0.65 手動時間與項目計時

原有的完成時間可在「手動」與「計時」兩種方式間切換。計時採時間戳記保存，重新整理或切換日期後仍可正確續計；同一時間只允許一個項目計時，開始另一項前會先提示暫停目前項目。顯示固定使用「分:秒」，秒數只會是 `00～59`，例如 `00:59` 的下一秒為 `01:00`，超過一小時則顯示為 `65:20`。按下「完成並填入」後，結果會換算回原有的整數分鐘欄位，不會自動勾選完成。計時中的項目也會顯示在頂部常駐狀態列。

### 0. v171.0.64 Prompt 公開路徑修正

Tracker 頂部的「排程建議prompt」改為直接指向同次部署內的 `gpt.prompt.html`，不再寫死舊的 GitHub Pages 網址。本機預覽、正式建置與 GitHub Pages 會使用同一份最新版 Prompt，避免開啟不同位置的舊檔案。

### 0. v171.0.63 排程建議 Prompt 更新

公開的 `gpt.prompt.html` 已更新為 2026-09-01 最新版：在主標題後加入延續排程規則的使用說明；「英文單字／片語互動題」改為驗收本日不熟悉內容；移除版本提示與列印／另存 PDF 功能，並降低頁面配色飽和度。公開網址維持不變。

### 0. v171.0.62 Calendar 講義版本欄位

Google Calendar 統一備註新增 `【講義版本】`：數學與自然會直接套用 Calendar 指定的教材版本；`【冊別】`仍只有數學使用。`【頁碼範圍】`與`【單元進度】`維持二選一，來源日期、選填重點及識別碼的解析方式不變。舊版未提供講義版本的行程仍維持原有 fallback。

### 0. v171.0.61 合併項目完整儲存修正

合併卡片及其中子項目的所有可編輯欄位，現在都會同步回實際保存的來源紀錄，而不只限於完成狀態、時間、頁碼與延期。錯因、訂正／批改、講義與單元、分數、單字及雜誌清單等內容，在切換日期、重新載入或 Calendar 重新整理後仍會保留；陣列型資料會以獨立副本保存，避免多個項目互相覆蓋。

### 0. v171.0.60 多項目儲存修正

同一天的雲端儲存改為依序執行，前一筆寫入完成後才送出下一筆，並在等待期間只保留最新的完整紀錄。這可避免快速修改或儲存多個項目時，多個請求共用舊 revision 而互相衝突，導致較晚修改的項目沒有同步到雲端。本機紀錄仍會即時保存，不需等待網路。手動按「儲存紀錄」時會重試尚未同步的內容，並在最新完整紀錄真正寫入雲端後才顯示成功。

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

以下為 v171.0.6 的歷史規則；延期處理已由 v171.0.81 改成兩個指標皆排除確認延期項目的分母，不再視為完成。

- **原訂今日項目完成率**：維持既有規則，完成或已延期的原訂今日項目都算已處理。
- **今日總項目完成率**：依今日原定項目與補做項目的項目數計算；只有實際完成才計入，延期不算完成。

週五另顯示週一至週五的「週五結算完成率」；週日顯示週一至週日的「本週結算完成率」，並標示相較週五結算的正負百分點。結算完成率是該期間「項目完成率」與「工作量完成率」的平均。

`171.0.7` 修正週五仍顯示「相較週五結算」的樣式問題：週五只顯示週五結算，週日才顯示比較。

`171.0.8` 將今日時間與數學統計排在上列，完成率雙指標移至下列，並移除多餘的「完成率雙指標」標題。

`171.0.9` 將原定工作量的分母定義為每日必做加上當日自行追加／補做項目；補做只影響工作量指標，不改變原定項目指標。每日必做勾選延期後，可指定加入同一週後續的星期二至星期日，既有未指定日期的延期仍以週日處理。

`171.0.10` 將「每日必做」改名為「今日項目」，新增可按日期查看的「本週項目」總覽，並在英文書目加入全書 115 Unit 的 `Essential Grammar in Use`。

`171.0.11` 將 `Essential Grammar in Use` 改為獨立的 Unit 欄位，不再使用頁碼欄位。Google Calendar 標題或說明中的 `Unit 12`、`Unit 12–14`、`Unit 12、14` 會拆成獨立項目，每個 Unit 可分別完成。

`171.0.12` 將今日總項目完成率改為項目數比例，不再依分鐘或頁數加權。分母是今日項目加上今日補做項目；分子只計實際勾選完成，延期不算完成工作量。`Essential Grammar in Use` 每個 Calendar Unit 各算一項。

`171.0.13` 將 Google Calendar 項目分流到「今日項目」與「本週項目」，且本週項目可直接勾選完成，不會重複出現在今日項目。

`171.0.14` 統一路由規則：未加特別前綴的 Google Calendar 行程一律進入「今日項目」；只有 `本週項目｜項目名稱` 進入「本週項目」。介面用字也已統一為「本週項目」。

`171.0.15` 修正延期後的補做項目：完整複製原項目的類型、內容、欄位與專用模板識別，Calendar、互動題、固定英文與其他特殊項目不再退化為一般填空卡；既有補做進度會保留，缺少的模板欄位會由原項目補回。

`171.0.16` 新增 Google Calendar 補做分流：`補做｜項目名稱` 或 `補做項目｜項目名稱` 固定加入「今日項目」，即使外層誤加 `本週項目｜` 也以補做規則優先。可辨識的數學、英文、自然等項目沿用完整模板；補做只加入工作量完成率，不增加原定項目分母。

`171.0.17` 全面固定延期模板身份：每個原定項目都保存自己的模板識別，延期副本完整保留原類型、標題、內容與所有欄位。另讓 Calendar 直接辨識「英文訂正與搭配詞整理」、「互動題」及「學測英文訓練：英文雜誌」，因此這三類延期或 Calendar 補做都會呈現原本的完整模板，而非一般填充格。

`171.0.18` 修正 Calendar 固定項目的模板與重複問題：辨識標題時允許日期、範圍與「補做」附註，像「學測英文訓練：英文雜誌｜8/28＋補做8/26」會直接使用完整英文雜誌模板；`英文歷屆／模考｜限時作答` 與內建的「英文歷屆／模考：限時作答」會合併為同一張卡片。舊版已保存的一般填充卡片也會在載入時升級回原模板，並遷移完成狀態、時間與已填內容；合併的補做仍會額外列入工作量分母。

`171.0.19` 將第二個完成率指標更名為「今日總項目完成率」，計算方式維持不變。

`171.0.20` 將第一個完成率指標更名為「原訂今日項目完成率」，計算方式維持不變。

`171.0.21` 修正延期補做的週結算：補做日即使已有相同的數學講義題目模板，也會保留延期副本；延期副本會納入今日總項目完成率及週五／本週結算的工作量，但不會重複增加原訂今日項目分母。

`171.0.22` 修正 Google Calendar 重複與刪除同步：同一天、同內容與同範圍的重複 Calendar 行程只建立一個統計項目，並在合併舊重複卡片時保留已完成狀態；每次重新讀取都會同步 Google 的刪除結果、清除所有本機日期中已不存在的 Calendar 卡片，狀態訊息會顯示移除筆數。

`171.0.23` 修正 Google OAuth callback：Supabase／Google 的物件錯誤會顯示可讀訊息，不再出現 `[object Object]`；callback HTML 使用 ASCII 字元實體與 UTF-8 標頭，避免中文錯誤頁亂碼。Calendar 連線需要套用 `google_calendar_client_id` migration 後再部署 callback Function。

`171.0.24` 修正延期 Calendar 項目的模板辨識：接受空白分隔、前置冊別、`p.起–迄`、`（原日期）` 與 `【延期來源】`，讓數學、古今悅讀、英文寫作等項目回到完整原始模板；延期數學另建補做卡片，不再覆蓋當日原訂數學進度。Google Calendar HTML 描述會先轉為純文字，不再顯示 `<p>` 標籤。

`171.0.25` 將延期目標選單改為只顯示原日期之後、且仍在同一週內的星期；例如星期五只顯示星期六與星期日，較早的星期不再以停用選項出現。

`171.0.26` 將延期限制由「整週最多 6 項」改為「每個目標日最多 3 項」。不同日期分別計數，例如星期一至星期四的項目最多可選 3 項延期到星期五；星期五額滿後仍可改選星期六或星期日。

`171.0.27` 將延期改為選擇目標星期後再按「確定延期至星期 X」；確定前只保留在畫面上，不儲存、不建立補做項目，也不影響今日與每週完成率。目標日顯示「星期 X（目前項數／3）」；既有資料若超過 3 項仍完整保留，超額數字以紅色提示。選擇已滿或超額日期時會顯示確認欄與「是／否」按鈕，只有選擇「是」才允許超額新增。

`171.0.28` 在頁面最上方標題列新增「排程建議 GPT Prompt」連結，並加入可由 GitHub Pages 直接開啟的 `gpt.prompt.html`；手機版會自動換行為整列按鈕。

`171.0.29` 將起床時間的分鐘限制修正為 00～59；在標題列最右側新增與原按鈕共用儲存功能的「儲存紀錄」；延期操作區精簡為目標星期、容量與「確認延期」，移除重複星期及上限說明文字，仍只有確認後才影響完成率。

`171.0.30` 修正已確認延期後改選目標日未重新判讀容量的問題。改選日期現在會先顯示新目標日既有延期數量，並要求再次按下「確認延期」；確認前保留原目標日與完成率狀態，額滿或超額時仍會顯示額外確認提示。

`171.0.31` 修正同一 Calendar 項目連續延期後因標題分隔符、簡稱或多個補做日期而退回通用模板的問題。現在可辨識「數學講義題目｜理解檢查＋錯題標記＋訂正」及「英文混合題與作文｜補8/26＋8/29」等變體，並還原原始完整模板；連續複製時也持續保留最初模板識別碼與欄位。

`171.0.32` 統一 Google Calendar 重排與 Tracker 延期的重複項目處理。同項目的重疊或連續頁碼會直接合併，例如 `p.1–5` 、`p.6–10`、`p.11–15` 合併為 `p.1–15`；有中斷的範圍或以回次計算的項目，則參考自然混合的呈現方式，收在同一張主卡片下成為可各自勾選的子項目。每個子項目仍獨立計入完成率，並在 Calendar 刪除或重排後保留仍存在項目的完成狀態。

`171.0.33` 修正連續頁碼跨越系統自動對應的單元或章節時無法合併的問題。合併身分現在只使用真正的教材與項目欄位，不再使用由頁碼反查產生的單元、章節或 Calendar 計畫名稱。因此數學講義 `p.149–165` 與 `p.166–173` 即使跨章，仍會正確合併為 `p.149–173`。

`171.0.34` 修正同一回次型項目因一筆為 Calendar 當日排程、另一筆為 Calendar 補做而無法合併的問題。`ACE Reading`、`古今悅讀一百`與`英文寫作測驗`的不同回次現在會收入同一張主卡，每個回次仍可獨立勾選。子項目各自保留原訂或補做身分，因此原訂今日項目與今日總項目完成率仍依原有規則計算。

`171.0.35` 將合併時點改為「每日清單完全建立後」，不再只在 Calendar 或延期各自的內部處理。因此 Calendar 當日排程、Calendar 補做與 Tracker 延期項目會先全部進入同一份當日清單，再統一進行合併。實際線上案例的數學講義 `p.158–165`、延期 `p.149–165` 與延期 `p.166–173` 會成為單一張 `p.149–173` 卡片；不連續範圍與不同回次則收在一張主卡內的獨立子項目。合併卡仍保留底層原始項目，勾選後會回寫各原始紀錄，以便下次 Calendar 刪除、重排或延期重建時正確還原。

`171.0.36` 移除標題列與頁面底部重複的儲存操作，只保留一個「儲存紀錄」。按鈕移入 Cloud／Calendar 的頂部常駐連線列，捲動頁面時仍可直接儲存；儲存成功、失敗與匯入匯出提示也會保留在同一常駐區域。原本底部區塊調整為純粹的「匯出與匯入」。

`171.0.37` 移除星期日固定排程「本週完成度與錯題整理」；舊紀錄中的系統預設卡片會在載入該日期時一併清除。匯出區附註改為「匯出可供 AI 分析本週概況」。點擊常駐的「儲存紀錄」後，按鈕會依序顯示「儲存中…」及「已儲存 ✓」或「儲存失敗」，並以顏色提供清楚反饋。

`171.0.38` 修正星期日空白的原訂「數學講義題目：理解檢查＋錯題標記＋訂正」無法與 Calendar／延期頁碼項目合併的問題。同名項目現在只顯示一張主卡，空白原訂項目與具體頁碼範圍以可分別勾選的子項目保留；相鄰範圍仍先合併，完成率則維持每個子項目各自計算。子項目的完成狀態會同步回底層來源，重新載入後不會消失。

`171.0.39` 將同科目卡片集中相鄰顯示，同一科目內仍保留原本順序。修正合併後「數學講義：進度」分鐘數寫入錯誤來源、重新載入後消失的問題。合併卡片的每個原訂子項目現在可獨立選擇日期並確認延期；容量以子項目逐筆計算，額滿提示、完成率、目標日補做建立與重新載入皆沿用獨立狀態，其他子項目不會一起延期。

`171.0.40` 修正合併後「數學講義：進度」的起始頁／結束頁只更新顯示卡、重新載入後被原始資料覆蓋的問題。修改範圍邊界時，現在會回寫真正擁有該邊界的來源項目，Calendar 再同步也會保留使用者明確修改的頁碼。另修正 Calendar 群組子卡來源判斷不符，導致無法各自延期的問題；一般子卡、Calendar 補做子卡及已延期後再次延期的子卡，現在都能獨立選擇日期、確認延期並正確計入目標日容量。

`171.0.41` 移除群組子卡片中重複的項目標題；數學延期／補做子卡的第二行改為左側 3/4 保留「對應單元／章節」，右側 1/4 顯示該子卡所有實際來源日期，一般子卡仍維持原本整行配置。今日與本週數學頁數改為展開群組內已完成的固定排程、Calendar 與延期子項目計算；未完成子項目不提前計入，重疊頁碼以相同教材／冊別去重，因此合併到大卡片後不再漏算或重複計算。

`171.0.42` 將延期／補做子卡的連續來源日期壓縮為起訖區間，例如 `8/26、8/27、8/28、8/29` 顯示為 `8/26-8/29`；日期中斷時則分段顯示，例如 `8/26、8/28-8/29`，避免來源日期欄位過長。

`171.0.43` 修正「數學講義題目：理解檢查＋錯題標記＋訂正」未合併：固定排程、Google Calendar 與延期項目現在以穩定模板代號辨識，不再因 `：`／`｜` 或 `＋`／`+` 等歷史標題差異被拆成多張卡片；連續頁碼仍合併為同一個可計數子項。

`171.0.44` 補上星期日的實際資料情境：固定卡已先套入當日 Calendar 頁碼時，即使延期卡的冊數／教材欄位不同，仍會歸入同一張「數學講義題目」大卡，並保留各自的頁碼範圍與完成狀態為不同子項。

`171.0.45` 將「數學講義題目：理解檢查＋錯題標記＋訂正」改為單層大卡：固定排程、Calendar 與延期範圍直接合併成一組欄位與一個完成勾選，不再顯示子卡片；隱藏來源仍同步保存，完成、延期及頁碼邊界修改會回寫所有對應來源。

`171.0.46` 統一 Google Calendar 頁碼優先規則：數學、物理、化學、生物、地科及英文文法若在 Calendar 標題／說明中提供明確頁碼，Tracker 直接採用該範圍；僅在沒有合法頁碼時，才依單元名稱、進度序號或既有對照表推算。既有的使用者手動頁碼修改仍保留，不會被同步覆蓋。

`171.0.47` 統一 Google Calendar 備註格式。只要行程使用下列標籤，Tracker 只讀取對應欄位，不再從其他自由文字猜測冊別、頁碼、進度、重點、來源日期或識別碼。單元名稱保留在 Calendar 標題內；`【頁碼範圍】` 與 `【單元進度】` 必須二選一，頁碼存在時一律優先並忽略單元進度。`【識別碼】` 作為跨重排的穩定項目識別，Google 原始 event key 仍保留供刪除同步使用。

```text
【講義版本】教學講義
【冊別】1
【頁碼範圍】p.174–181
【單元進度】／
【重點】多項式函數與運算
【來源日期】8/31
【識別碼】math-polynomial-01
```

`【冊別】` 只用於數學，其他科目直接省略整行。`【重點】` 是選填欄位，沒有重點時也直接省略整行。

若改用單元進度，請將頁碼範圍填為 `／`，例如：

```text
【講義版本】教學講義
【冊別】1
【頁碼範圍】／
【單元進度】3/11
【重點】多項式函數與運算
【來源日期】8/31
【識別碼】math-polynomial-03
```

`171.0.48` 修正非數學科目的標準備註：不再要求或顯示 `【冊別】`，`【重點】` 也改為可完全省略。英文文法的 Google Calendar 排程資訊框會依序顯示「單元名稱（單元進度）」、「重點」（僅在有填寫時）與「建議頁碼」（固定顯示）；沒有重點時不再顯示 `重點：—`。

`171.0.49` 精簡英文文法的 Google Calendar 排程資訊框：單元名稱與 `(n/總數)` 僅供系統選取正確建議頁碼，不再於框內重複顯示。有重點時只顯示「重點」與「建議頁碼」；沒有重點時只顯示「建議頁碼」。

`171.0.50` 統一來源日期顯示條件：當日原訂 Calendar 項目隱藏「來源日期」，只有來源日與目前卡片日期不同，或項目屬於 Tracker 延期／Calendar 補做時才顯示；延期合併卡仍保留完整的日期區間。

`171.0.51` 修正 Google Calendar 實際行程備註可能自動換行的問題：`【識別碼】`會移除空白與換行後再作為穩定識別，避免同一項目因排版變動產生重複卡片；「自然整合」也會直接讀取新版 `【頁碼範圍】`與`【重點】`，並持續相容舊版 `【講義／頁碼】`、`【複習】`及`【複習規則】`。

`171.0.52` 將網站頂部連結文字精簡為「排程建議prompt」，並把連結所開啟的內容更新為精簡版 GSAT 排程與 Google Calendar 同步 Prompt；公開網址維持 `gpt.prompt.html`，既有連結不需更改。

`171.0.53` 新增低飽和科目色彩辨識：數學使用霧藍、國文使用淡紅棕、英文使用淡紫、自然與自然整合共用鼠尾草綠，其他項目使用中性灰。顏色套用於一般卡片、Calendar／延期合併卡、子卡片及本週項目列，並保留原有完成與延期狀態提示。

`171.0.54` 將低飽和科目色延伸到整張卡片與子卡片內層，不再只有標題列著色。使用者勾選完成並使「今日總項目完成率」首次超過 50% 時，顯示小型淡色紙花與「你已經完成一半了，繼續努力！」；首次達到 100% 時顯示加強版慶祝與「今日事今日畢！」。每個門檻每日只顯示一次，延期、Calendar 同步、分母變動及取消勾選不會誤觸發，並支援系統的減少動態效果設定。

`171.0.55` 修正科目色與慶祝回饋未實際呈現的問題。所有巢狀子卡片與內層區塊現在會強制沿用該子項目的科目色；數學由接近原介面底色的霧藍改為淡米黃色。慶祝紀錄升級為新版狀態，避免前一版未顯示的紀錄阻止動畫；若完成率已超過 50% 但尚未成功慶祝，下一次勾選完成時會補顯示一次。

`171.0.56` 將一半完成的觸發條件由「超過 50%」修正為「達到 50%（含）」，因此完成率剛好由低於一半升至 50% 時會立即播放小慶祝。同步升級每日慶祝狀態，避免前一版測試紀錄阻止修正版第一次播放。

`171.0.57` 調整科目卡片的視覺層級：外層大卡保留原本的淡科目色，巢狀子卡片與其標題列改用同科目但更接近白色的次級淡色，讓合併項目的父子關係更容易辨識。

`171.0.58` 再降低所有科目色的飽和度，子卡片改為近白色同系表面；同時加入向右內縮、較小圓角、較細左側色線與輕微陰影，以結構差異強化父卡／子卡層級，而不依賴鮮豔色差。

`171.0.59` 將主卡片的科目背景、邊框與標題色恢復為 `171.0.57` 的辨識強度；子卡片則保留 `171.0.58` 的近白低飽和配色、內縮、較小圓角與陰影。父卡與子卡使用獨立色彩變數，避免子卡再次繼承較深的主卡色。

Calendar 自然項目的資訊列採 3:1 配置：左側「Google Calendar 當日主題」佔 3/4，右側「來源日期」佔 1/4；延期項目顯示原日期，一般項目顯示 Calendar 排定日期。

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
