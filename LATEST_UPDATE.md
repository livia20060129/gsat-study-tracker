# 最新更新

版本：v171.0.71

## 本次有更新的項目

- 生物／自然項目的頁碼若已被先前完成範圍完整涵蓋，仍會自動勾選今日卡片與「進度」。
- 使用者手動取消卡片完成後，會記住取消狀態；重新整理、儲存或 Calendar 同步後不會再次自動勾選。
- 使用者手動取消卡片內的「進度」後，也會獨立記住，不會影響卡片完成勾選。
- 若日後已完成頁碼不再涵蓋今日範圍，只有系統自動建立的勾選會被移除，人工選擇仍優先保留。
- 新增 4 項回歸測試。

## 部署範圍

- 僅需重新部署前端；不需更新 Supabase Database 或 Edge Functions。

## Commit 建議

`fix(natural): preserve manual override for page coverage completion`
