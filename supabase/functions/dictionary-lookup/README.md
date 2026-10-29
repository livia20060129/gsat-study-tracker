# 已停用的線上字典端點

自 v171.6.95 起，自動帶入與「取得翻譯」都使用前端隨附的本機 ECDICT 子集，不需要登入、後端或字典 API 金鑰。未收錄的詞可手動填入；不自動抓取外部字典。

此目錄保留作為舊部署的停用入口，而非可重新設定金鑰啟用的服務。

## 回應

- OPTIONS 回覆 204，供舊版請求完成預檢。
- 其餘方法回覆 HTTP 410，JSON 代碼為 `dictionary_retired`，並指示使用本機 ECDICT。
- 不讀取查詢內容、登入 token 或環境金鑰，不連接外部 API 或資料庫，不回傳舊候選。
- 不快取回應。公開跨來源標頭僅允許讀取固定停用訊息，不提供資料操作。

共用來源解碼仍接受既有 Cambridge 出處，以免舊紀錄或匯出遺失來源；新選譯只接受 ECDICT。相容解析器不再產生 Cambridge 候選。

## 更新既有部署

覆蓋前端不會自動停用已部署的舊函式。原 GitHub 部署流程會部署此停用入口，並檢查 HTTP 410 與 `dictionary_retired`。也可在已登入且有部署權限的本機執行：

```sh
supabase functions deploy dictionary-lookup --project-ref YOUR_PROJECT_REF
```

無需 migration 或新增 secrets。此程式不再使用既有 Cambridge secrets；是否移除遠端舊 secrets 由專案管理者決定。本次本機更新沒有操作遠端部署或 secrets。

## 驗證

`tests/dictionaryLookup.test.ts` 驗證固定停用回應、無外部請求、ECDICT 選譯及歷史資料往返。`e2e/dictionaryLookup.spec.ts` 使用隔離瀏覽器資料驗證離線、未登入、確認前不保存、保留手動翻譯及並行欄位合併，不使用真實帳號或字典服務。

CI 的 `npm run typecheck:edge` 仍檢查此 Deno 入口；本機需先有 Deno 才能執行該指令。
