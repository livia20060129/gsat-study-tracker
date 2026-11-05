# Vocabulary reference data

自用版 v171.6.117，更新日期 2026-11-02。中文翻譯與自動勾選詞性使用 ECDICT；大考中心資料只用來帶入學測 Level。保留手動修改，不將字典翻譯標為大考中心提供。

v171.6.143（2026-11-05）僅調整前端資料表示：`scripts/build_compact_vocabulary.py` 由原始參考模組產生 `ceecCompactIndex.ts` 與 `ceecCompactTranslations.ts`，保留全部 6,191 個拼字及原始詞性、Level、翻譯。核心詞庫文字隨程式供離線使用，個別翻譯查詢時才解碼，擴充詞庫仍採原分片按需下載。來源、授權、出處標註及手動覆寫規則維持不變；完整參考模組供產生與逐字驗證，不再打包到前端。

## 1. 大考中心：學測 Level

- 著作：財團法人大學入學考試中心基金會《高中英文參考詞彙表》（111 學年度起適用），109 年 7 月。
- [官方公布頁](https://www.ceec.edu.tw/xmdoc?xsmsid=0K213553204833715309)。使用使用者提供的 PDF，SHA-256：`27b010f8230b2e8763653ddb35783fe9e0140c143b0040f13839046aebb2a126`。
- 印刷頁 53–103（PDF 第 65–115 頁）共 6,012 筆詞條，每級 1,002 筆；展開原表明列的別名及變化形式後有 6,191 個查詢鍵。同字跨級保留全部級數，預設較低級並顯示提示；表外拼法不猜填 Level。
- `src/data/ceecVocabulary.ts` 仍保留原表的詞性、詞條及印刷頁碼供追查，但不再以官方詞性限制 ECDICT 查詢結果。
- 原檔聲明僅供非營利目的使用，轉載須註明出處，營利用途需事前書面同意；官方資料不適用 ECDICT 的 MIT 授權。PDF 本身沒有中文釋義。

## 2. ECDICT：中文與詞性

- [ECDICT 原始資料庫](https://github.com/skywind3000/ECDICT)，使用 [ecdict.csv](https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv)，非 mini 範例詞庫。
- 本次 CSV SHA-256：`d1ecbdf9ee2b920afb6f430ca6b6bb9f559588cf0dff86e04bd255f9390843cc`。
- [原版 MIT LICENSE](https://github.com/skywind3000/ECDICT/blob/master/LICENSE)，`Copyright (c) 2025 Linwei`；完整授權位於 `public/licenses/ECDICT-MIT.txt`，有翻譯 PDF 也附全文。
- 依同拼法中文行中的詞性標記分組，n／v／vt／vi／a／adj／ad／adv／prep／conj／pron／art／aux 對應既有詞性選項，不跨詞性挪用中文。只有無法對應既有詞性的中文時保留未分詞性；已能分詞性的詞條不再重列額外領域附註。
- 排除人名行及不安全文字，依括號外標點分列意思，再使用 OpenCC `s2twp` 轉為繁體。這些是規則轉換的參考資料，不是逐字人工審訂；使用者可自行修改。
- 6,182 個官方表內拼法的 ECDICT 資料置於 `src/data/ceecTranslations.ts`，可直接使用。ECDICT 詞性與官方表可能不同，例如 abandon 的名詞／動詞及 may 的名詞／助動詞，均依字典實際列出的中文分組。
- 擴充索引有 723,781 個含中文的查詢鍵，位於 `public/dictionaries/ecdict-v1/`，分成 256 份。靜態 JSON 共 47,680,711 bytes，單份最多 195,781 bytes。瀏覽器只按需下載對應一份，記憶體最多保留 8 份，不將全詞庫加入 JavaScript 或 LocalStorage。
- 網站只向本站取得詞庫檔，在瀏覽器精確比對拼法，不傳送輸入內容至外部字典，不使用爬蟲或生成式翻譯。首次載入擴充詞庫需要連線，已保存的翻譯可離線查看及手動編輯。

## 3. 重建

需要 Python、pypdf 及 `opencc-python-reimplemented==0.1.7`（Apache-2.0）。工具只在建置時執行，不加入網站執行期依賴。原始 PDF、CSV 與暫存工具不放入部署包。

若更新官方表，先依原 PDF 重新建立官方索引：

```powershell
python scripts/build_vocabulary_reference.py --pdf "完整路徑/高中英文參考詞彙表(111學年度起適用).pdf" --dictionary "完整路徑/ecdict.csv" --output src/data
```

接著必須執行新的 ECDICT 產生器，產生不受官方詞性限制的核心資料及擴充詞庫；只更新 ECDICT 時直接執行這一步：

```powershell
python scripts/build_ecdict_lookup.py --dictionary "完整路徑/ecdict.csv" --project .
```

兩支腳本都可用 `--vendor "套件目錄"` 指定獨立建置套件。詞庫產生器不下載來源、不更動 PDF／CSV；輸出固定 hash 分桶、核心翻譯與 manifest。更新來源時一併核對 LICENSE、SHA-256、資料筆數、欄位、來源頁及測試，不只更新版本號。

## 4. 輸入、修改及保存

- v171.6.144：擴充詞庫查詢及預覽直接使用每次查詢完成的回應，避免 8 組分片快取淘汰後漏填；Tracker 回填核對沿用既有訪客預設資料空間，缺少顯式標記不再使合法訪客回應被略過。明確切換其他帳號仍拒絕延遲回應，未更動詞庫內容、來源或授權。

- Tracker 輸入完整單字並離開欄位，或於英文單字複習頁修改英文後，自動帶入 ECDICT 中文與詞性，不需先按「取得翻譯」或確認。組合／句子維持手動整理。
- 先保存英文，再完成按需查詢。回應時重新比對資料空間、日期及單字；延遲回應不替換已改掉的英文，切換日期後只更新原紀錄。載入失敗不刪除輸入，仍可手動填寫與稍後重試。
- `vocabularyAutoFill` 追蹤自動填值；`vocabularyManualFields` 的各欄位布林標記保護手動修改、取消及刻意清空，也避免兩台裝置修改不同欄位時只因標記產生衝突。
- 使用既有詞性、`translation`、`translationsByPartOfSpeech`、`gsatLevel`、`showGsatLevel` 與 JSON 儲存格式，沿用匯出／匯入、合併及帳號同步。不新增資料庫欄位，不在唯讀載入時批次重寫舊紀錄。
- 編輯模式的字典預覽仍可勾選意思再追加，保留既有中文。來源集中於單字複習頁標題下方；舊紀錄中的歷史來源繼續保留，不將其他字典釋義改標為 ECDICT。

執行完整單元、型別、正式建置與 Chromium／WebKit 測試，涵蓋表外字、詞性差異、手動優先、延遲回應、載入失敗重試、範圍／日期跳轉、JSON round-trip、合併與 PDF 授權。資料版本見 `public/vocabulary-reference-manifest.json` 及詞庫目錄內的 manifest。

## 5. Google Translate 備援（v171.6.145）

ECDICT 確認未收錄中文後，所有已登入 Tracker 的正式帳號使用 Google Cloud Translation Basic v2。只翻譯單一英文詞。中文來源保留為 Google Translate；v171.6.146 起詞性可另外對照既有 ECDICT／大考中心同拼法資料，不使用 Natural Language API。只有一種詞性時放入該組，多詞性時譯文保留未分詞性而不重複複製；無資料時保留手動，不猜詞性／Level。手動修改優先。訪客及 ECDICT 網路錯誤不發出此付費備援請求。

Google 翻譯支援集中在複習頁上方顯示官方原始標章，連結至 https://translate.google.com/ ；PDF／DOCX 保留來源。`public/google-translate-attribution.png` 來自 Google 官方 [標章套件](https://docs.cloud.google.com/static/translate/images/google-translate-attribution.zip)，屬 Google 品牌資產，不受 ECDICT MIT 授權涵蓋。完整設定見 [GOOGLE_TRANSLATION_SETUP.md](./GOOGLE_TRANSLATION_SETUP.md)，處理資料見中英隱私權政策。


v171.6.146 起取消 UUID 白名單，依 Supabase Auth 帳號按月計算最多 5,000 個英文單字，一次送出一個詞扣 1，不按字母／字元數計算。每月 1 日台北時間自動改用新月份額度。ECDICT 或快取命中不扣；已送出查詢即使失敗仍計入用量。資料庫原子扣額與短期識別碼避免並行及傳輸重試超額，不影響原本讀書紀錄、手動修改、Level 或來源保存。詳見設定文件的 migration 與權限說明。

## 6. 補充詞性與外部辭典（v171.6.146）

`scripts/build_ecdict_fallback_parts.py` 從同一份 ECDICT CSV 的明示詞性標籤擷取 11,331 筆中文不可用詞的詞性，來源 SHA-256 寫入 `src/data/ecdictFallbackParts.ts`，沿用 MIT 授權。僅在 Google 回傳中文後才按需載入；詞性與中文保存各自出處，手動取消／修改不會被重設。

複習頁可選擇牛津辭典或劍橋英語－繁體中文辭典的外部連結，選擇保存在本機。切換只更新英文連結，不替換編輯器、不改讀書資料，也不擷取外站釋義。Google 翻譯支援只在頁首顯示一次。

## 7. 手動 Google 預覽（v171.6.147）

單字編輯區提供獨立「Google 翻譯」按鈕，登入後可直接查詢；自動流程仍只在 ECDICT 確認未收錄中文時備援。Google 預覽不修改紀錄，確認後追加意思，保留手動中文及原 Level。每筆新增來源存為 google，與原 ECDICT／歷史來源並存；匯出同時列出實際來源，不將 Google 內容標為 ECDICT。

使用同一個每月 5,000 個英文單字額度；查詢時扣額，快取命中免費。單字改寫、帳號變更或編輯關閉後的過期結果不可填入；切換查詢來源時較舊回應不替換目前預覽。
