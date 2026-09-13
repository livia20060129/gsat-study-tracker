# 最新更新

版本：v171.2.0

## 本次一次完成

1. 整張卡片刪除前確認；小項目刪除提供 8 秒復原。
2. 加入忘記密碼、重寄驗證信與回站設定新密碼。
3. 儲存按鈕明確區分「已存本機」與「Cloud 已同步」。
4. Cloud badge 顯示同步中、待同步天數、已同步或失敗。
5. 斷線恢復後立即重試待同步紀錄。
6. 正在輸入時不強制刷新；失焦後安全合併雲端資料，也可立即套用。
7. 連續輸入採 200 ms debounce；勾選、延期、刪除與離頁仍立即保存。
8. 手機展開連線設定後改為可關閉的 bottom sheet，不再佔住整頁捲動。
9. Google Calendar 解除連線移至危險區並加入確認。
10. 加入 Playwright 真實瀏覽器 E2E，部署前自動驗證主要操作。
11. README 依指定八大章節重整並更新至 v171.2.0。

更新資料夾：`gsat-study-tracker-v171.2.0-safety-ux-e2e-update`

## 驗證

- TypeScript 檢查通過。
- 299 項單元／回歸測試全部通過。
- 3 項 Chromium E2E 全部通過。
- 正式 Vite 建置通過。

本次不需要新增 Supabase migration，也不需要重新部署既有 Calendar Functions。若要啟用忘記密碼，請確認 Supabase Auth Redirect URLs 已包含正式 Tracker 網址。

## Commit 建議

`feat(safety): add recovery sync status undo and browser e2e`
