# Google 登入設定與舊帳號轉換

適用個人版 v171.6.180，正式網站為 https://myself.liviayeh.dev ，Supabase 專案為 `arxbirgujbrtzhoficdf`。

本版先加入 Google 主登入及「綁定 Google 帳號」，保留原 Email／密碼登入供既有使用者轉換。讀書資料、Calendar 連線及每月 5,000 字翻譯額度繼續使用原 Supabase UUID。

## 1. Google Cloud 建立登入專用用戶端

開啟 [Google Auth Platform](https://console.cloud.google.com/auth/overview)。建立登入專用的 OAuth 用戶端，類型選擇 **Web application**。

- Authorized JavaScript origins：`https://myself.liviayeh.dev`
- Authorized redirect URIs：`https://arxbirgujbrtzhoficdf.supabase.co/auth/v1/callback`
- 基本登入權限只需要 `openid`、`userinfo.email`、`userinfo.profile`。
- Audience 若要讓一般 Google 使用者登入，選 External，完成正式發布所需設定。Testing 階段先把自己的 Google 帳號加入測試使用者。
- 完成 Branding：應用程式名稱、支援信箱、首頁與政策頁。

保存此「登入專用」Client ID／Client Secret，下一步填到 Supabase 的 Google provider。Secret 只放 Supabase 後台。

既有 Calendar 的 OAuth 用戶端、callback 及 `VITE_GOOGLE_CLIENT_ID` 沿用原設定。不要把登入專用 Client ID／Secret 覆蓋到既有 `GOOGLE_CLIENT_ID`／`GOOGLE_CLIENT_SECRET` Edge Function Secrets。

若現有 Cloud 專案因 Calendar 敏感權限仍顯示未驗證警告，可把基本登入放到獨立 Google Cloud 專案；Calendar 繼續使用原專案。Google 登入成功不代表已授權讀取 Calendar。

## 2. Supabase 啟用 Google 與帳號綁定

開啟 [專案 Authentication 設定](https://supabase.com/dashboard/project/arxbirgujbrtzhoficdf/auth/providers)。

1. 在 Sign In / Providers 找到 **Google** 並啟用。
2. 填入上一步登入專用的 Client ID／Client Secret。
3. 保持 nonce 驗證啟用，不要開啟 Skip nonce checks。
4. 在 Authentication 設定中開啟 **Manual Linking**，讓已登入的舊帳號能綁定 Google。這項功能在官方文件中仍標示為 beta。
5. 轉換期間保留 Email provider 啟用。

在 Authentication → URL Configuration 設定：

**Site URL**

```text
https://myself.liviayeh.dev
```

**Redirect URLs** 加入以下精確網址，並保留原本有效的密碼復原等網址：

```text
https://myself.liviayeh.dev/
https://myself.liviayeh.dev/index.html
https://myself.liviayeh.dev/index.html?google_auth=1
```

Google Cloud 的 redirect URI 是 Supabase 的 `/auth/v1/callback`；這裡的 Redirect URLs 是 Supabase 完成登入後返回 Tracker 的網址，兩者不同。

若另外測試其他正式網域或專案子目錄，需將相對應的 origin 與固定 callback 網址加入兩邊設定。不要使用任意網域的廣泛萬用規則。

## 3. 套用檔案與部署

將「必要覆蓋檔案」依原路徑合併到個人版專案，提交並沿用目前 GitHub Actions 部署方式。此版沒有新增套件、SQL migration 或 Edge Function；Google provider／Manual Linking 設定需要在上一步的 Supabase 後台完成，不會由前端覆蓋檔自動啟用。

新版的 Google 登入按鈕位於主頁「連線設定 → Cloud 帳號與同步」。未登入仍可使用訪客本機紀錄。

## 4. 你自己的舊帳號先這樣轉換

1. 使用目前的 Email／密碼登入原帳號。
2. 確認原有讀書紀錄已出現，並等帳號紀錄載入完成。
3. 按 **綁定 Google 帳號**，在 Google 選擇之後要使用的帳號。
4. 返回網站後確認顯示 **Google 已綁定** 及沿用原帳號的訊息。
5. 登出，再按 **使用 Google 繼續**，確認原有紀錄、Calendar 連線與翻譯額度仍在。
6. 再測一次手機、重新整理及待辦／總結往返。

同 Email 的 Google 登入可依 Supabase 規則自動連結，但舊使用者優先採用上述「先登入舊帳號，再綁定」流程。不同 Email 也可在原帳號內綁定；若 Google 身分已經綁定另一個獨立帳號，會顯示錯誤，前端不會自行合併兩個帳號的資料。

如需核對 UUID，可在 Supabase → Authentication → Users 查看綁定前後是否仍為同一筆使用者。原資料表與額度不需搬移。

全部舊使用者都確認轉換成功後，再另行移除 Email／密碼介面與調整 provider。先保留這個轉換入口，避免舊使用者無法綁定原帳號。

## 常見訊息

| 網站訊息 | 處理方式 |
|---|---|
| Google 登入尚未完成設定 | 確認 Supabase Google provider、登入用戶端 ID／Secret 與 redirect URI |
| 尚未啟用帳號綁定 | 開啟 Supabase Manual Linking |
| Google 帳號已綁定其他帳號 | 改用原本綁定的帳號登入；不要直接刪除舊使用者 |
| 登入連結已過期或缺少驗證資料 | 回到網站重新按登入；在同一個瀏覽器完成，並允許網站儲存空間 |
| 回傳帳號與原帳號不同 | 綁定已中止，原紀錄保留；重新登入原帳號再操作 |
| 舊 Email 密碼復原連結無法開啟 | 重新索取連結，並在發出請求的同一個瀏覽器完成 |

## 驗證範圍

自動測試使用真正的 Supabase 瀏覽器 SDK 與 PKCE，攔截 Google／Supabase 回應來驗證應用程式流程與資料隔離。正式 Google 帳號的授權與線上後台設定仍需按上述步驟完成一次人工驗收；此交付沒有更動線上設定。

## 官方參考

- [Supabase Google 登入](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Supabase 身分連結](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Google 登入按鈕規範](https://developers.google.com/identity/branding-guidelines)
