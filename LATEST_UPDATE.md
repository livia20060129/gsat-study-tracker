# 最新更新

版本：v171.5.14

## Cloudflare Workers 部署設定

- 新增 `wrangler.jsonc`，明確把 Vite 的 `dist` 指定為 Workers Static Assets，不再進入 Wrangler 自動改寫 Vite 的流程。
- 固定 Wrangler `4.132.0` 與 Node.js 22，避免 Cloudflare 每次部署臨時安裝不同工具版本。
- 新增 `npm run deploy:cloudflare`，可在本機先建置再部署。
- 保留既有多頁入口，並使用 SPA fallback 處理直接開啟網址的情況。
- 新增部署設定回歸測試，確認資產路徑、無 Worker entry、工具版本與部署命令維持正確。

更新資料夾：`gsat-study-tracker-v171.5.14-cloudflare-deploy`

## Cloudflare 設定值

```text
Build command: npm run build
Deploy command: npx wrangler deploy
Root directory: /
```

## 驗證

- 單元／回歸測試通過。
- TypeScript 型別檢查與 Vite 正式建置通過。
- Wrangler 靜態資產部署 dry-run 通過。

本次不需要新增 Supabase migration，也不需要重新部署 Supabase Edge Function。

## Commit 建議

`fix(deploy): configure Cloudflare static assets explicitly`
