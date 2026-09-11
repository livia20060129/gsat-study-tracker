# 最新更新

版本：v171.1.1

## 本次新增

- 英文書目新增「Azar英文文法系列（中階）」。
- 建立照片目錄所列第 1～14 章、149 個分項的完整頁碼對照。
- Google Calendar 可用 `GAST-AZAR-2026-XXX` 識別碼辨識本書。
- Calendar 提供頁碼後，Tracker 會以章節建立大卡片，並把涵蓋的分項列為可分別勾選、計時及延期的子項目。
- 例如 `p.31–39` 會顯示「第二章：過去式」，並建立 `2-1`、`2-2`、`2-3` 三個分項。
- 相同起始頁的分項不會被合併，例如 `p.85` 仍會分開顯示 `3-9` 與 `3-10`。
- 教材進度圖新增本書，依各分項的實際紀錄分別填色。
- 自行新增英文項目時也可選擇本書並查看頁碼對應結果。

## Calendar 備註格式

```text
【頁碼範圍】p.31–39
【識別碼】GAST-AZAR-2026-001
```

Calendar 標題建議直接使用 `Azar英文文法系列（中階）`；只要識別碼符合上述格式，也能正確辨識。

## 更新檔案

- `src/data/azarGrammar.ts`
- `src/calendar/calendarBridge.ts`
- `src/legacy-app.ts`
- `src/study/materialProgress.ts`
- `public/gpt.prompt.html`
- `tests/azarGrammar.test.ts`
- `tests/materialProgress.test.ts`
- `package.json`
- `package-lock.json`
- `LATEST_UPDATE.md`

更新資料夾：`gsat-study-tracker-v171.1.1-azar-grammar-update`

## 驗證

- 259／259 項測試通過。
- TypeScript 檢查通過。
- 正式 Vite 建置通過。

## Commit 建議

`feat(english): add Azar grammar page mapping and section tracking`
