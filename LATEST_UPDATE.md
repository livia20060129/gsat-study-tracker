# 最新更新

版本：v171.0.73

## 本次有更新的項目

- 「今日項目／本週項目」合併為同一個顯示區域；按標題按鈕即可切換，項目內容與數量同步切換。
- 「今日完成數學頁數／本週完成數學頁數」合併為同一張統計卡；按一下即可切換。
- 英文雜誌月份預設為 Tracker 所選日期的月份，例如選擇 2026-09-03 時預設為 9 月。
- 預設月份只會自動套用一次，之後可自由修改或清空，不會在重新整理時被覆蓋。
- 新增 4 項英文雜誌月份回歸測試，完整測試目前共 146 項。

## 部署範圍

- 僅需重新部署前端；不需更新 Supabase Database 或 Edge Functions。

## 更新資料夾

- `gsat-study-tracker-v171.0.73-update`
- 僅包含本次有修改的檔案，並保留原本目錄結構；未建立 ZIP。

## Commit 建議

`feat(ui): add item and math summary toggles with magazine month default`
