# 最新更新

版本：v171.6.30

## Azar 文法書 Calendar 讀取與卡片

- Azar 與自然教材同樣以書本印刷頁碼的起訖範圍讀取，不要求「講義版本」或「冊別」；Calendar Prompt 增加沒有講義版本的 Azar 範例。
- `GSAT-AZAR-YYYY-...` 與舊 `GAST-AZAR-YYYY-...` 識別碼均可辨識；舊式「頁碼範圍：18–29 頁」備註也可讀取。標準欄位只讀 `【頁碼範圍】`，不會被自由文字中的其他頁碼干擾。
- Calendar Azar 卡片顯示書名、可填寫的起始頁與結束頁、Google Calendar 當日主題及即時的頁碼對應章節。修改實際頁碼後重新整理或重新讀取 Calendar 仍保留使用者填寫值。
- 原本依章節小節分開的項目維持分項，來源建議頁碼只取 Calendar 指定範圍與小節的交集；不改變既有勾選與分鐘資料。

## 驗證

- 新增 Azar 新舊識別碼、標準及舊備註、卡片欄位、頁碼覆寫與重新分組，以及 Prompt 範例測試。
- 419 項單元／回歸測試、TypeScript 型別檢查、Vite 正式建置與 16 項 Chromium E2E 全部通過。

更新資料夾：

- `gsat-study-tracker-v171.6.30-azar-natural-template-required-files`
- `gsat-study-tracker-v171.6.30-azar-natural-template-full-project`

## Commit 建議

`feat(calendar): align Azar page entry with natural materials`
