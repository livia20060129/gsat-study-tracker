# 最新更新

版本：v171.0.67

## 本次有更新的項目

- 新增具版本控制的 Study Record codec；既有未標版本的紀錄會自動升級，並保留未知欄位。
- localStorage 與 Supabase 的紀錄 payload 統一經過相同的編碼／解碼流程，避免兩端格式逐漸分歧。
- 不支援或損壞的資料格式會被拒絕，不會當成正常紀錄直接套用。
- 數學與自然排程改為只從 `src/data` 載入，移除 `legacy-app.ts` 內的重複排程常數。
- 部署流程改用 `npm ci`，並在正式建置前先執行完整測試。
- 新增跨層回歸測試，驗證合併卡、子項目、頁碼、完成狀態、延期及計時狀態在儲存與重載後仍正確。

## 部署範圍

- 僅需重新部署前端；不需更新 Supabase Database 或 Edge Functions。

## Commit 建議

`refactor(storage): add versioned study record codec and CI guardrails`
