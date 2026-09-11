# 最新更新

版本：v171.1.2

## 本次修正

- 正式顯示名稱改為「Azar英文文法（中階）」。
- 同時相容 Calendar 既有的「Azar英文文法系列（中階）」名稱。
- 修正未辨識名稱時退回一般 Calendar 項目、整段只顯示一列的問題。
- Calendar 頁碼涵蓋幾個分項，Tracker 就建立幾個可獨立完成的項目，不再包在章節大卡內。
- 每列標題統一為：`Azar英文文法（中階）｜Ch.x 章名｜分項編號＋分項名稱`。
- `p.18–29` 會分別顯示：
  - `Azar英文文法（中階）｜Ch.1 現在式｜1-6通常不用於進行式的動詞`
  - `Azar英文文法（中階）｜Ch.1 現在式｜1-7現在式動詞：Yes/No問句之簡答`
- 每列仍可分別勾選、計時、填入時間與延期。
- 從 v171.1.1 的章節大卡升級時，會依分項編號承接已完成、時間與延期狀態。

## Calendar 備註格式

```text
【頁碼範圍】p.18–29
【識別碼】GAST-AZAR-2026-001
```

Calendar 標題建議使用 `Azar英文文法（中階）｜W1｜Ch.1 現在式`；`W1` 不會出現在 Tracker 產生的分項標題中。

## 更新檔案

- `src/data/azarGrammar.ts`
- `src/legacy-app.ts`
- `tests/azarGrammar.test.ts`
- `tests/materialProgress.test.ts`
- `public/gpt.prompt.html`
- `package.json`
- `package-lock.json`
- `LATEST_UPDATE.md`

完整覆蓋資料夾：`gsat-study-tracker-v171.1.2-complete`

此資料夾包含完整專案原始碼、GitHub Actions、Supabase Functions、資料庫 migrations 與測試；不是只含本次異動檔案的增量包。`src/ui/completionTrend.ts` 已包含在內，可修正 GitHub Actions 的缺檔建置錯誤。

## 驗證

- 260／260 項測試通過。
- TypeScript 檢查通過。
- 正式 Vite 建置通過。

## Commit 建議

`fix(english): render Azar Calendar ranges as separate section rows`
