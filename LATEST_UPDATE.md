# 最新更新

版本：v171.0.80

## 本次有更新的項目

- 英文書籍新增「大考英聽A攻略」。
- 使用與 ACE Reading 相同的進度、批改、訂正及錯因模板。
- 原本的回次欄改為 `Test`，只接受 `1～10` 的整數。
- Google Calendar 可辨識 `大考英聽A攻略｜Test N`、`英文｜大考英聽A攻略｜Test N` 及標準備註中的 `【單元進度】Test N`。
- Calendar 的 `Test N-M` 會拆成各自可完成、計時及延期的 Test 子項目；超出 Test 10 的部分不會建立。
- Calendar 重排、Tracker 延期與重複延期後，仍保留原書籍模板與各 Test 的資料。
- 匯出摘要會顯示「大考英聽A攻略｜Test N」，不會誤用「第 N 回」。
- 新增 5 項 Calendar、合併與延期回歸測試，完整測試目前共 171 項。

## 部署範圍

- 僅需重新部署前端。
- 不需更新 Supabase Database、Migration、Secrets 或 Edge Functions。

## 更新資料夾

- `gsat-study-tracker-v171.0.80-update`
- 僅包含本次有修改或新增的檔案，並保留原本目錄結構；未建立 ZIP。

## Commit 建議

`feat(english): add 大考英聽A攻略 Test template`
