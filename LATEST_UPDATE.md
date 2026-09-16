# 最新更新

版本：v171.5.13

## 完成勾選日期與延期來源同步

- 未延期項目若在原日期之後才手動勾選，會顯示並保存實際日期，例如 `2026-09-17 勾選`。
- 同日勾選或提前勾選未來項目時，不會建立額外的勾選日期。
- 延期卡在延期日或之後完成時，會顯示 `延期完成：YYYY-MM-DD`，並同步勾選原日期的來源項目。
- 取消勾選會清除日期；若為延期完成，也會同步還原原日期來源。
- 完成的延期卡在重新載入或重建排程後仍會保留，不會因原日期已同步完成而消失。
- 一般卡片、可獨立完成的子卡片及本週項目共用相同規則。

更新資料夾：`gsat-study-tracker-v171.5.13-completion-check-dates`

## 驗證

- 357 項單元／回歸測試通過。
- TypeScript 型別檢查與 Vite 正式建置通過。
- 8 項 Playwright 桌機／手機瀏覽器測試通過，其中包含延期日完成後回寫原日期及取消勾選的實際流程。

本次不需要新增 Supabase migration，也不需要重新部署 Edge Function；完成日期會隨既有 JSON 紀錄同步，只需部署新版 GitHub Pages 前端。

## Commit 建議

`feat(completion): record check dates and sync deferred origins`
