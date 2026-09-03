# 最新更新

版本：v171.0.79

## 本次有更新的項目

- JSON 不再於離開欄位時直接匯入，改為「預覽匯入」後再按「確認匯入」。
- `Ctrl+Enter` 只會開啟預覽，不會直接改動紀錄。
- 匯入前會完整檢查所有日期與項目格式；任一筆格式錯誤時整批停止，且不修改任何本機或雲端資料。
- 預覽會逐日列出新增、更新、無變更及既有同步衝突。
- 確認匯入前會保存可復原的本機備份，並提供「復原上次匯入」。
- 本機多日寫入若中途失敗，會復原本次已寫入的日期；不會留下只有一部分日期完成的本機匯入。
- 雲端同步改為逐日檢查實際結果，分別回報成功、衝突、失敗與未同步，不再把失敗誤報為全部成功。
- 匯入不再清除既有 `syncConflict`；有衝突的日期不會自動覆蓋雲端。
- Supabase JS 已改為固定版本的 npm dependency，由 Vite 隨前端一起打包，不再於執行時載入浮動 CDN 版本。
- 新增 7 項匯入與 Supabase 打包測試，完整測試目前共 166 項。

## 部署範圍

- 僅需重新部署前端。
- 不需更新 Supabase Database、Migration、Secrets 或 Edge Functions。
- 部署平台必須使用 `npm ci`（或依 `package-lock.json` 安裝）後再執行 `npm run build`，以包含固定的 Supabase dependency。

## 更新資料夾

- `gsat-study-tracker-v171.0.79-update`
- 僅包含本次有修改或新增的檔案，並保留原本目錄結構；未建立 ZIP。

## Commit 建議

`fix(import): add safe preview and bundle Supabase client`
