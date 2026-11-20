# 最新更新

版本：v171.6.193（個人版）

## 原生 App 鎖定畫面計時

- Android 持續通知、iPhone／iPad 即時動態顯示讀書項目、累計時間及「暫停／繼續」，點內容可返回該日期。
- Android 與 iOS 17 以上可直接操作；iOS 16.4–16.x 的控制會開啟 App。iPad 即時動態需要 iPadOS 17 以上。
- 系統自行更新時間；不以 JavaScript 背景輪詢維持畫面。App 暫停執行或 WebView 重新載入後，保留原生操作並寫回原工作卡。
- 寫回前核對帳號、來源項目與計時版本；保留正在輸入的筆記、其他讀書欄位及真正的新修改。寫入失敗時保留原生計時，不用過時的時間完成工作。
- 完成、重設、改為手動、完成項目或切換帳號會結束目前顯示；暫停時保留累計時間及「繼續」。
- 沿用主頁與待辦共用的計時器，不新增同步循環、不修改雲端結構或登入流程。

## 套用

以 v171.6.192 為基礎，將「必要覆蓋檔案」依原路徑合併，沒有需要刪除的檔案。執行：

~~~text
npm ci
npm test
npm run build
npm run check:app
npm run native:sync
npm run native:check
~~~

原生 App 必須重新編譯安裝：Android 執行 npm run native:android:debug；iOS 在 Mac 執行 npm run native:ios，在 App 與 StudyTimerWidget 兩個 target 選擇相同簽章 Team。沒有 Mac 時可使用既有手動 Build native test apps 工作流程檢查 iOS 模擬器建置，但不會產生可裝到手機的簽署 IPA。

詳見 [鎖定畫面計時設定與驗收](native/LOCK_SCREEN_TIMER.md)。xcode 4.0.0 改為明確鎖定的開發依賴；Android 新增測試專用 org.json 依賴。沒有 SQL、Edge Function、Google Cloud 或 Supabase 設定異動。

本次未部署、未執行線上工作流程、未產生 APK／IPA；此 Windows 環境沒有 Android SDK／Xcode，尚待原生平台編譯與實機驗收。瀏覽器橋接測試不代表真正鎖定畫面已通過驗收。

English commit suggestion:

~~~text
feat: add native lock screen study timers with pause and resume
~~~
