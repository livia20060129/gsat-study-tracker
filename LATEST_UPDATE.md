# 最新更新

版本：v171.6.55

## 排除英文訂正整理待辦

- 「英文訂正與搭配詞整理」不再出現在待辦事項。
- 原日期中的紀錄卡、勾選、時間、單字與搭配詞資料保持不變，只有待辦清單將其排除。
- 同時辨識目前的 `weekday_english_review` preset key 與舊資料中的同名紀錄。

## 驗證

- 單元測試確認新版與舊版「英文訂正與搭配詞整理」都不會成為待辦。
- Chromium E2E 確認待辦總數不包含此項目，其他英文與數學待辦仍正常顯示及操作。

## Commit 建議

`fix(todo): exclude English correction review from overdue tasks`
