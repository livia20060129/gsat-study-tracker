# Google 登入設定

適用個人版 v171.6.185。正式網站：https://myself.liviayeh.dev 。Supabase 專案：arxbirgujbrtzhoficdf。

本版已完成主要舊帳號的 Google 綁定與實際登入驗收，改為只提供 Google 登入。保留原 Supabase 使用者、Email 身分、UUID、讀書紀錄、Calendar 連線及翻譯額度；未刪除閒置帳號或其紀錄。

## 1. Google Cloud 登入用戶端

在 [Google Auth Platform](https://console.cloud.google.com/auth/clients?project=gsat-study-tracker) 使用登入專用的 Web application 用戶端。

| 欄位 | 值 |
|---|---|
| Authorized JavaScript origins | https://myself.liviayeh.dev |
| Authorized redirect URIs | https://arxbirgujbrtzhoficdf.supabase.co/auth/v1/callback |
| Scopes | openid、userinfo.email、userinfo.profile |

Audience、測試使用者及 Branding 依實際發布狀態設定。Calendar OAuth 用戶端與既有 Edge Function Secrets 沿用。

## 2. Supabase Google provider

開啟 [Google provider](https://supabase.com/dashboard/project/arxbirgujbrtzhoficdf/auth/providers?provider=Google)。

- Enable Sign in with Google：開啟。
- Client IDs 與 Client Secret：使用同一個登入用戶端的憑證。
- Skip nonce checks：維持關閉。
- 儲存。Client Secret 只放 Supabase 後台，不放前端或儲存庫。

若顯示選擇帳號後仍未綁定，查看 Supabase Auth logs。若 Google 回應 invalid_client 且指出 client secret 無效，重新核對同一用戶端的 Client ID／Secret；不能把另一個 Calendar 用戶端的 Secret 混填。

## 3. 網址設定

在 [Authentication → URL Configuration](https://supabase.com/dashboard/project/arxbirgujbrtzhoficdf/auth/url-configuration) 設定 Site URL：

~~~text
https://myself.liviayeh.dev
~~~

Redirect URLs 逐筆加入以下網址，其他正在使用的有效返回網址保留：

~~~text
https://myself.liviayeh.dev/
https://myself.liviayeh.dev/index.html
https://myself.liviayeh.dev/index.html?google_auth=1
~~~

Google Cloud 的 redirect URI 是 Supabase 的 callback；此處的 Redirect URLs 是 Supabase 完成登入後返回 Tracker 的網址。

## 4. 停用 Email 登入

開啟 [Email provider](https://supabase.com/dashboard/project/arxbirgujbrtzhoficdf/auth/providers?provider=Email)，將 **Enable email provider** 關閉，按 Save。

Google provider 維持開啟。停用登入方式與刪除使用者不同：保留 Authentication → Users、原 Email 身分與資料表中的紀錄。保留已綁定帳號的原 UUID；無須搬移資料、清空密碼欄位或刪除身分。

網站已移除 Email／密碼登入、建立帳號、忘記密碼、重寄驗證信及密碼更新介面。舊 Email／密碼復原返回連結會被攔截、清除返回憑證並提示改用 Google，不交換舊登入碼或取代目前帳號。

Manual Linking 維持原設定，供仍持有既有有效登入狀態的帳號綁定使用。後續若需要恢復閒置 Email 帳號，須另行規劃轉換；不能直接新建另一筆使用者來取代舊 UUID。

## 登入前顯示保存失敗時

登入前會先保存目前的讀書紀錄。若時間、頁碼或其他欄位未通過檢查，或紀錄無法寫入，會顯示「登入前的讀書紀錄尚未保存」與具體原因，保留輸入並停止跳轉。

手動儲存或登入前保存失敗時，桌面與手機會在畫面下方顯示不自動消失的錯誤提示，可按關閉；修正後成功儲存也會收起。原本一般灰字通知仍於五秒後移入連線設定。

只有登入驗證資料真的無法保存時，才顯示「無法保存登入驗證資料」。未修改且已保存的紀錄不再為登入重寫，但仍核對本機保存內容；真正未保存的草稿仍會阻止離開頁面。

v171.6.183 加入本機容量恢復：遇到空間不足時，以可還原、含校驗的格式壓縮訪客、待同步及衝突紀錄與訪客轉入憑據，完整保留內容後重試保存。已壓縮日期後續仍採相同格式，各頁讀取、雲端同步及 JSON 匯出均還原完整內容。既有備份、帳號、日期與實際紀錄不會刪除。

部署後，若目前畫面仍有未保存輸入，先複製保留，再重新整理同一網站，按「儲存」或「使用 Google 繼續」即可啟動容量恢復。其他舊版分頁也應在保留草稿後重新整理。不要清除網站資料。若裝置仍無法寫入，系統保留原紀錄與輸入並顯示原因，不會略過保存強制跳轉。

## 5. 套用與驗收

將未壓縮「必要覆蓋檔案」依原路徑合併到個人版專案，先執行 `npm ci` 安裝鎖定的 pako 3.0.2，再沿用現有建置／部署方式。沒有 SQL migration 或 Edge Function。

部署後：

1. 開啟連線設定，確認只有 Google 登入入口，沒有 Email／密碼與復原表單。
2. 使用已綁定的 Google 帳號登入，確認原紀錄及 Calendar 連線。
3. 登出，再用 Google 登入；檢查待辦／總結往返與重新整理仍正常。
4. 已登入的既有帳號可持續使用；未登入仍可保存訪客本機紀錄。

## 驗證範圍

自動測試使用真實 Supabase SDK 與 PKCE，攔截外部授權回應，驗證登入與資料隔離。正式 Google 登入與原紀錄、Calendar 連線已由使用者驗收；新版前端仍需部署後再次確認畫面。

## 官方參考

- [Supabase Google 登入](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Supabase 身分連結](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Email 與密碼登入](https://supabase.com/docs/guides/auth/passwords)
