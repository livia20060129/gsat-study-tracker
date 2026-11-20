# Android 與 iPhone／iPad App：第五階段

v171.6.190 提供兩平台的原生測試工程，沿用既有 Tracker 介面及雲端帳號。Android 與 iOS 共用 Capacitor 8.6.2；不是指向遠端首頁的空殼。介面、ECDICT、中文字型及匯出程式會包進 App，首次啟動即可離線使用本機功能。

目前完成工程、圖示、登入回跳、Calendar 回跳、系統分享、返回鍵與網頁層驗證。此電腦沒有 Android SDK，且是 Windows；尚未在這裡編譯 APK、IPA，亦未在真正 Android／iOS 裝置或商店驗收。商店正式送審前的剩餘事項見 native/STORE_RELEASE.md。

v171.6.193 新增原生鎖定畫面計時。Android 需允許「讀書計時」通知；iOS 新增 StudyTimerWidget extension，App 與 Widget 都需選擇同一簽章 Team。iOS 17／iPadOS 17 以上可直接暫停／繼續，iOS 16.4 控制會開啟 App。設定、限制與驗收見 [native/LOCK_SCREEN_TIMER.md](native/LOCK_SCREEN_TIMER.md)。

## 先設定登入回傳

1. 開啟現有 Supabase 專案 → Authentication → URL Configuration → Redirect URLs。
2. 保留原有網址，另加這一筆完整網址並儲存：

~~~text
gsattracker://auth/callback?google_auth=1
~~~

3. Google Cloud 原本登入用 Web OAuth Client 與 Supabase Google Provider 設定沿用。Google 收到的 callback 仍是 Supabase 的 HTTPS callback，不要把自訂 scheme 填到 Google Web OAuth 用戶端的「已授權重新導向 URI」。
4. 合併本版後，沿用現有 Actions／部署方式更新 google-calendar 與 google-calendar-callback 兩個 Edge Functions。無 SQL migration，無新 secret；Calendar 原本的 APP_RETURN_URL 保留 HTTPS 網站網址。
5. 在 App 重新使用同一 Google 帳號登入。App 使用系統瀏覽器授權，回傳後沿用 PKCE 與原 UUID 保護；不把 access token 放進回跳網址。Calendar 的 App 回傳目標放在伺服器簽章 state 中，仍會核對及消耗一次性 nonce。

本次交付沒有修改線上 Supabase 設定或部署函式。現有連線工具沒有提供修改 Auth Redirect URLs 的功能，因此上述一筆網址需由專案管理者在 Dashboard 設定。

## 安裝工具與準備工程

需要 Node.js 22。第一次合併後執行：

~~~powershell
npm ci
npm run native:sync
npm run native:check
~~~

native:sync 會建置 dist-native、同步兩個工程並核對 callback、版本與 iOS 隱私清單。原有 npm run build 仍只產生網頁版 dist。

若更換圖示，在 native/assets/icon.png 放入來源後執行 npm run native:icons；現有平台圖示已產生並包含在交付檔案。

## Android：先產生測試 APK

1. 安裝 Android Studio 2025.2.1 或更新版。在 SDK Manager 安裝 Android SDK Platform 36、Build Tools 36.0.0 與 Platform Tools；使用 Android Studio 內建 JDK 21。
2. 執行 npm run native:android 開啟 android 工程；在 Android Studio 確認 SDK 路徑與 Gradle JDK。
3. 連接開啟開發者模式與 USB 偵錯的 Android 裝置，或建立模擬器，按 Run。最低 Android 7；系統 WebView 需 107 以上。
4. 命令列建置需設定 ANDROID_HOME 指向自己的 SDK，並讓 JAVA_HOME 指向 JDK 21；Android Studio 裡的 Gradle JDK 選擇不會自動套用到命令列。依自己的安裝位置設定後執行：

~~~powershell
npm run native:android:debug
~~~

5. 測試 APK 位於 android/app/build/outputs/apk/debug/app-debug.apk。這是開發測試簽章，不能直接當成 Google Play 正式發布。

不要把 local.properties、keystore、密碼或簽章私鑰上傳到程式碼儲存庫。正式發布須自行保存上傳金鑰並在 Android Studio 產生簽署 AAB；上架識別碼目前為 dev.liviayeh.gsat，首次上架前確認，發布後不要隨意更改。

## iPhone／iPad：在 Mac 建置與安裝

1. 在 Mac 安裝 Xcode 26 或更新版與 Node.js 22，將同一份原始碼及必要覆蓋檔案放到 Mac。
2. 執行 npm ci、npm run native:sync、npm run native:check，再執行 npm run native:ios。
3. 在 Xcode 選 App target → Signing & Capabilities，選自己的 Team，確認 Bundle Identifier 為 dev.liviayeh.gsat，開啟自動簽署；再為 StudyTimerWidget target 選相同 Team，確認 extension ID 為 dev.liviayeh.gsat.timer。專案同時支援 iPhone 與 iPad，最低 iOS／iPadOS 16.4；iPad 即時動態需 iPadOS 17。
4. 先選模擬器按 Run。命令列驗證可用 npm run native:ios:simulator；這只建置模擬器，不產生可安裝到手機的 IPA。
5. 接上 iPhone／iPad，在 Xcode 選裝置按 Run，依裝置提示信任開發者及開啟開發者模式。
6. 正式 TestFlight／App Store 需 Apple Developer、簽章與 App Store Connect；先完成 native/STORE_RELEASE.md 的登入與帳號刪除項目，再進行外部測試／送審。

PrivacyInfo.xcprivacy 已加入 Xcode Resources，包含檔案時間戳與 App 自用 UserDefaults 的使用理由；實際商店隱私表仍須依最終功能核對填寫。

## 沒有本機工具時的建置工作流程

新增 Build native test apps，只有手動觸發，不自動送審或部署。原始碼推到自己的 GitHub 後：

1. Repository Variables 沿用 VITE_GOOGLE_CLIENT_ID 公開用戶端識別碼。
2. Actions → Build native test apps → Run workflow，選 both、android 或 ios。
3. Android 工作會產生開發測試 APK；iOS 工作在 macOS runner 建置模擬器工程，無需上傳 Apple 憑證，亦不會產生簽署 IPA。

此工作流程已寫入檔案，但本次沒有推送或執行線上工作流程，不代表平台編譯已通過。

## 資料、更新與必測流程

- App 與瀏覽器分別儲存資料；登入同一 Google 帳號使用原雲端紀錄，不把瀏覽器 token 複製到 App。
- 訪客若要跨容器使用，先在原瀏覽器登入 Google，保存並確認轉入雲端成功，再到新 App 登入同一帳號。v171.6.191 已移除安裝設定中的手動備份及還原工具；首頁原有 JSON 預覽匯入仍可用。
- PDF、Word 與原始損壞紀錄備份改用系統分享，可選檔案、雲端硬碟或其他 App；分享選單開啟不等於已存到目的位置。
- App 的程式更新由安裝檔或商店提供，不啟用網站的 Service Worker 更新；雲端讀書資料仍使用原同步規則。
- 請保留 appId、hostname、scheme 與本機資料格式。更換這些值可能改變資料空間；更新／移除測試版前先保存並確認同步成功。
- 依序測：首次離線啟動、Google 登入與取消、Calendar 連接回跳、原帳號紀錄、跨頁保存、計時與鎖屏、PDF／Word 分享、JSON 預覽匯入、鍵盤／手勢及升版保留資料。不要用瀏覽器模擬測試代替實機測試。

## 參考

- [Capacitor 環境與平台工具](https://capacitorjs.com/docs/getting-started/environment-setup)
- [Supabase 原生 App 回跳](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Capacitor App 事件與 URL](https://capacitorjs.com/docs/apis/app)
- [Filesystem 與 Apple 隱私清單](https://capacitorjs.com/docs/apis/filesystem)
