# 正式商店發布前仍需完成

本版是第五階段的雙平台測試工程。以下是實際剩餘項目，不代表已上架、已取得證書或已通過審查。

## 共用

- 先完成 NATIVE_APP_SETUP.md 的 Supabase callback 與兩個 Calendar 函式更新，再以真正裝置測試。Web 端測試及系統橋接模擬無法證明原生編譯、系統授權、鍵盤或簽章已可用。
- 確認 Bundle／Application ID、App 名稱、支援信箱、隱私政策網址與正式簽章擁有者；不要提交範例帳號或私鑰。
- 依最終功能製作真實手機／平板截圖、商店說明、版本資訊、年齡分級及資料安全／隱私表。不得把「有系統分享選單」填成「不會傳出任何資料」。
- 登入及雲端功能的審查方式要能讓審查人員實際操作。Google OAuth 若仍在測試模式，只允許測試名單，應先完成正式使用資格／驗證安排。
- 帳號刪除目前是支援頁與 App 內的申請入口，由營運者確認處理；不是自助刪除 API。處理請求時須一併處理帳號、讀書紀錄、Calendar 憑證、快取及用量資料，保留法律上必要資料時應明確告知。

## Google Play

1. 建立／使用 Google Play Console 開發者帳號，確認目前帳號要求的身分與封閉測試流程。
2. 本工程 target SDK 36，符合查核時 2026 年新應用與更新的最低目標；正式送件前仍需重新核對當期要求。
3. 使用自己的正式上傳金鑰產生 AAB，先內部測試。測試 APK 的開發簽章不能替代正式簽章。
4. Data safety 應如實涵蓋登入信箱／識別碼、讀書與 Calendar 使用者內容、翻譯請求及帳號額度紀錄。帳號／資料刪除網址可使用：

~~~text
https://myself.liviayeh.dev/support.html#account-deletion
~~~

5. 實際審查與測試要求依 Play Console 顯示完成，未執行前不能聲稱已通過。

## Apple App Store／外部 TestFlight

1. 使用自己的 Apple Developer 與 App Store Connect，設定 Team、簽章、App 記錄及裝置權限。
2. 目前仍只有既有 Google 登入。若依 App Review 4.8 需要等效的隱私登入選項，應完成 Sign in with Apple 等合規方案及相應 Supabase 設定；不要只新增一顆無法使用的按鈕。為保留紀錄，原帳號新增登入身分時要沿用既有 UUID，不能將不同帳號不經確認合併。
3. 目前由支援信箱提出的人工刪除申請，不能直接當成已完成 Apple 的 App 內帳號刪除要求；正式送審前需完成適用的 App 內刪除流程、使用者確認及伺服器／憑證清理，並測試實際刪除。
4. 核對 App 的離線紀錄、計時、系統檔案分享與其他操作是否達到最低功能要求；不得宣稱包裝網站必然通過。
5. 在真正 iPhone 與 iPad 測試登入回跳、鎖屏、分享、資料保存及升版；使用自己的簽章 Archive，上傳後依 Apple 流程處理審查。

本次沒有新增 Apple 登入、執行帳號刪除、建立開發者帳號、購買服務、上傳商店或承諾通過審查。這些是正式發布的後續工作。

## 當期規則來源

- [Google Play 目標 API](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Google Play 帳號刪除要求](https://support.google.com/googleplay/android-developer/answer/13327111)
- [Apple App Review Guidelines：登入、帳號刪除與最低功能](https://developer.apple.com/app-store/review/guidelines/)
