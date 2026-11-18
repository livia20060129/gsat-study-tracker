# 最新更新

版本：v171.6.190（個人版）

## 第五階段：雙平台原生測試工程

- 新增 Android 與 iPhone／iPad 的 Capacitor 8.6.2 工程，使用同一份 Tracker 程式與既有帳號。
- 介面、詞庫、中文字型與匯出程式包進 App，可直接離線開啟。網頁版仍建置至 dist；原生 App 使用 dist-native，不啟用網頁 Service Worker 更新。
- Google 登入改由系統瀏覽器授權，再回 App 沿用 PKCE 與原有帳號保護。Calendar 回傳目標納入既有 HMAC 與一次性 nonce 核對，不接受任意回跳網址。
- PDF、Word、JSON 與原始紀錄備份使用系統分享；超過一天的匯出暫存於下次匯出清理，不清除讀書紀錄或登入資料。
- 加入原生返回鍵、Prompt 複製、兩平台圖示、iOS 隱私清單，以及手動觸發的 GitHub 建置工作流程。
- 原生最低 iOS／iPadOS 16.4；Android target SDK 36、最低 Android 7，WebView 107 以上。

## 套用與下一步

先依 NATIVE_APP_SETUP.md，在現有 Supabase 的 Auth Redirect URLs 新增：

~~~text
gsattracker://auth/callback?google_auth=1
~~~

再更新 google-calendar 與 google-calendar-callback，無 SQL migration 或新 secret。Google Cloud 原登入用戶端與 Supabase Google Provider 沿用。

使用 npm ci、npm run native:sync、npm run native:check 準備工程。Android 需 SDK／Android Studio，iOS 需 Mac／Xcode 與自己的簽署設定。

本機已完成原始碼與網頁層準備，沒有 Android SDK 或 macOS，尚未產生 APK／IPA，亦未執行線上建置、部署或商店送審。正式發布仍須完成 native/STORE_RELEASE.md 的 Apple 登入、App 內帳號刪除、簽章及實機驗收；不要將測試工程誤稱正式上架完成。

English commit suggestion:

~~~text
feat: add Android and iOS native app projects with secure auth callbacks
~~~
