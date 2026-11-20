# 鎖定畫面計時：v171.6.193

原生 Android、iPhone 與 iPad App 啟動讀書計時後，在鎖定畫面顯示「項目、累計時間、暫停／繼續」。暫停會停止累計但保留顯示；回到 App 按「完成並填入」寫入原工作卡的分鐘欄。點通知／即時動態內容會返回來源日期。

## 哪些開啟方式支援

| 開啟方式 | 顯示與操作 |
| --- | --- |
| Android 原生 App | 系統持續通知，直接暫停／繼續；Android 13 以上第一次開始計時時詢問通知權限 |
| iPhone iOS 17 以上原生 App | 即時動態，直接暫停／繼續；支援機型另有動態島 |
| iPhone iOS 16.4–16.x 原生 App | 即時動態；控制按鈕開啟 App 後執行暫停／繼續 |
| iPad iPadOS 17 以上原生 App | 即時動態與暫停／繼續，顯示位置依系統支援 |
| 網站、加入主畫面的 PWA／瀏覽器捷徑 | 沿用 App 內計時，沒有原生鎖定畫面控制 |

App 內計時不依賴鎖定畫面顯示權限；拒絕通知／即時動態時仍可使用原計時器。Android 請允許 App 通知及「讀書計時」通知類別，並允許鎖定畫面顯示內容。iOS 請在系統設定允許 App 即時動態。項目名稱可能出現在鎖定畫面，可依系統隱私設定隱藏內容。

系統仍可收起、關閉或限制顯示。Apple 的單筆即時動態最多維持活動八小時；需要再顯示時，開啟 App 並操作計時。計時以保存的起始時間與累計秒數計算，顯示被關閉不會刪除讀書紀錄。Android 使用系統通知計時元件，不新增前景服務、常駐輪詢或喚醒鎖。

## 合併後怎麼做

1. 在專案根目錄執行 npm ci、npm run native:sync、npm run native:check。不要直接修改 dist-native 或平台內複製的網頁資產。
2. Android：沿用 [NATIVE_APP_SETUP.md](../NATIVE_APP_SETUP.md) 的 JDK 21、SDK 36 設定，執行 npm run native:android:debug。此指令會先執行原生計時狀態單元測試，再產生測試 APK。
3. iOS：在 Mac 開啟工程，App 與新增的 StudyTimerWidget 兩個 target 使用同一個開發者 Team。Bundle ID 分別是 dev.liviayeh.gsat 與 dev.liviayeh.gsat.timer；更換主 App ID 時需一併調整 extension ID 與 scripts/configureLockTimerProject.cjs。
4. 執行 npm run native:ios:simulator 檢查 iOS 工程，再使用自己的簽章安裝到 iPhone／iPad。沒有 Mac 時，原始碼推到自己的 GitHub 後，可手動執行既有 Build native test apps 工作流程；iOS 工作只檢查模擬器建置，實機安裝仍需 Apple 簽章。
5. 先更新既有 App 安裝，保留 appId、scheme 與資料空間；不要用刪除 App 的方式更新。只有更新網站不會更新原生 App 功能。

不需新的 Google／Supabase 設定、SQL migration、APNs、推播伺服器或 App Group。iOS 的 LiveActivityIntent 在 App 程序處理操作，共享 Widget 只收到顯示所需的項目與計時狀態。

## 寫回與資料保護

- 全 App 同時只有一個活動計時；主頁、待辦及巢狀來源共用原有計時欄位。
- 原生端保存獨立的操作紀錄；WebView 暫停時，鎖定畫面控制不依賴網頁程式運作。
- 回到 App、切換頁面及操作計時前，依原帳號、日期、項目與基準版本合併，只修改計時欄位，保留筆記與其他編輯。
- 重複／過時按鈕不重複累計；舊計時不能覆蓋已重設、已完成或另一項新計時。切換帳號後保留尚未確認的原帳號操作，選回該帳號才寫回。
- 若本機寫入失敗，顯示提示並保留原生紀錄；在寫回確認前阻止以過時秒數完成計時。待空間／權限恢復後重新開啟 App 再試。
- 維持原有雲端同步時機；鎖定畫面操作不額外啟動持續同步。Android 私有偏好儲存及 iOS App 私有檔案保存原生狀態，Widget 內容不包含登入憑證或筆記。

## 實機必測

- 由主頁與待辦各開始一次計時，鎖屏顯示正確項目及秒數；暫停五秒不增加，再繼續會累加。
- App 留在背景後從鎖定畫面暫停／繼續，重新開啟 App 及切換頁面，時間與原卡一致。
- 頁面有未完成的筆記編輯時操作鎖定畫面，筆記保留；完成並填入的分鐘正確。
- 重設、改手動、勾選完成後不再顯示舊計時；切換帳號不帶入原帳號項目。
- 拒絕通知／關閉即時動態、系統隱藏內容及手動移除顯示後，App 內計時仍正常。
- 測試真實 Android 13 以上、iPhone iOS 17 以上、iPadOS 17 以上，以及仍支援的 iOS 16.4 fallback。另測試安裝新版後原登入與紀錄保留。

本次完成程式、狀態單元測試及瀏覽器原生橋接測試。Windows 環境沒有 Android SDK／Xcode，尚未編譯 APK／IPA 或完成上述實機驗收。

## 平台文件

- [Android 系統通知計時](https://developer.android.com/reference/android/app/Notification.Builder#setUsesChronometer(boolean))
- [Apple 即時動態與系統顯示限制](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)
- [Apple 即時動態互動與 App 程序](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities)
