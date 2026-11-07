import type { NaturalCalendarPlan } from '../calendar/naturalPlan.ts';
import type { GrammarPlanCandidate } from '../calendar/grammarPlan.ts';

export const CALENDAR_NATURAL_RECOMMENDED_PAGES: Record<string, NaturalCalendarPlan> = {
 "2026-08-17":{
  subject:"生物",material:'123日的淬鍊',ranges:[[4, 7]],
  label:"細胞是生命系統的基本單位",basis:"細胞學說、細胞大小與種類、原核／真核比較；p.8 起進入胞器。"
 },
 "2026-08-18":{
  subject:"化學",material:'123日的淬鍊',ranges:[[9, 20]],
  label:"物質分類與粒子觀",basis:"物質的組成前段：純物質／混合物、元素／化合物及物理、化學變化。"
 },
 "2026-08-19":{
  subject:"生物",material:'123日的淬鍊',ranges:[[10, 13]],
  label:"細胞膜與膜運輸",basis:"細胞膜構造、膜蛋白與膜運輸相關內容。"
 },
 "2026-08-20":{
  subject:"物理",material:'123日的淬鍊',ranges:[[2, 19]],
  label:"量測、單位與圖表表達方式",basis:"Chapter 1 緒論：物理量、SI 單位、科學記號及基本資料表達。"
 },
 "2026-08-21":{
  subject:"生物",material:'123日的淬鍊',ranges:[[8, 13], [40, 43]],
  label:"胞器、尺度與構造功能",basis:"胞器功能與合作流程；另搭配顯微觀察相關頁面。"
 },
 "2026-08-24":{
  subject:"化學",material:'123日的淬鍊',ranges:[[45, 63]],
  label:"原子結構、同位素與週期表",basis:"Chapter 2 前段：原子結構、電子排列、同位素與週期性。"
 },
 "2026-08-25":{
  subject:"物理",material:'123日的淬鍊',ranges:[[20, 55]],
  label:"基本交互作用與受力模型",basis:"Chapter 2 物質的組成和交互作用，涵蓋基本交互作用與受力觀念。"
 },
 "2026-08-26":{
  subject:"生物",material:'123日的淬鍊',ranges:[[14, 15]],
  label:"酵素與反應速率",basis:"細胞代謝起始：酵素、活化能與代謝控制。"
 },
 "2026-08-27":{
  subject:"化學",material:'123日的淬鍊',ranges:[[64, 83]],
  label:"化學鍵與分子間作用力",basis:"Chapter 2 後段：鍵結、結構、作用力與物性。"
 },
 "2026-08-28":{
  subject:"生物",material:'123日的淬鍊',ranges:[[14, 15]],
  label:"ATP、氧化還原與代謝路徑",basis:"ATP 循環與細胞代謝能量耦合。"
 },
 "2026-08-31":{
  subject:"生物",material:'123日的淬鍊',ranges:[[16, 20]],
  label:"細胞呼吸",basis:"細胞呼吸的主要階段、位置、物質流與 ATP。"
 },
 "2026-09-01":{
  subject:"化學",material:'123日的淬鍊',ranges:[[97, 112]],
  label:"化學式、反應式與守恆",basis:"Chapter 3 前段：化學式、反應式、計量與守恆。"
 },
 "2026-09-02":{
  subject:"生物",material:'123日的淬鍊',ranges:[[16, 20]],
  label:"光合作用",basis:"光合作用光反應、碳反應與限制因子。"
 },
 "2026-09-03":{
  subject:"物理",material:'123日的淬鍊',ranges:[[184, 199]],
  label:"功、能量、功率與效率",basis:"Chapter 6 前段：功、動能、位能、功率及能量轉換。"
 },
 "2026-09-04":{
  subject:"化學",material:'123日的淬鍊',ranges:[[113, 128]],
  label:"反應熱、能量圖與催化",basis:"Chapter 3 後段：反應熱、活化能、能量圖與催化。"
 },
 "2026-09-05":{
  subject:"生物",material:'123日的淬鍊',ranges:[[16, 21]],
  label:"呼吸與光合作用比較",basis:"兩種代謝作用的物質流、能量流、胞器位置與比較。"
 },
 "2026-09-07":{
  subject:"物理",material:'123日的淬鍊',ranges:[[56, 75]],
  label:"位置、速度、加速度圖",basis:"Chapter 3 前段：運動描述、x-t／v-t／a-t 圖及斜率、面積。"
 },
 "2026-09-08":{
  subject:"物理",material:'123日的淬鍊',ranges:[[76, 97]],
  label:"牛頓定律、摩擦與圓周運動",basis:"Chapter 3 中段：受力、牛頓定律、摩擦與圓周運動。"
 },
 "2026-09-09":{
  subject:"化學",material:'123日的淬鍊',ranges:[[130, 145]],
  label:"溶液濃度、溶解度與稀釋",basis:"Chapter 4 前段：溶液分類、濃度表示、溶解度與稀釋。"
 },
 "2026-09-10":{
  subject:"生物",material:'123日的淬鍊',ranges:[[24, 33]],
  label:"細胞週期、有絲分裂與減數分裂",basis:"染色體、細胞週期、有絲分裂、減數分裂與配子形成。"
 },
 "2026-09-11":{
  subject:"物理",material:'123日的淬鍊',ranges:[[98, 113]],
  label:"動量、衝量與碰撞",basis:"Chapter 3 後段：動量、衝量、碰撞與守恆條件。"
 },
 "2026-09-14":{
  subject:"物理",material:'123日的淬鍊',ranges:[[144, 157]],
  label:"波的描述與傳播",basis:"Chapter 5 前段：週期、頻率、波長、波速、相位與波的傳播。"
 },
 "2026-09-15":{
  subject:"物理",material:'123日的淬鍊',ranges:[[158, 183]],
  label:"聲音、干涉、繞射與光",basis:"Chapter 5 後段：聲音、反射／折射、干涉、繞射與光的波動現象。"
 },
 "2026-09-16":{
  subject:"生物",material:'123日的淬鍊',ranges:[[74, 77]],
  label:"DNA 結構與複製",basis:"DNA／RNA 結構與 DNA 複製。"
 },
 "2026-09-17":{
  subject:"生物",material:'123日的淬鍊',ranges:[[78, 81]],
  label:"轉錄、轉譯與基因表現",basis:"中心法則、轉錄、轉譯與蛋白質合成。"
 },
 "2026-09-18":{
  subject:"化學",material:'123日的淬鍊',ranges:[[146, 158]],
  label:"水溶液離子、酸鹼與中和",basis:"Chapter 4 中段：電解質、酸鹼、pH 與中和。"
 },
 "2026-09-19":{
  subject:"地科",material:'123日的淬鍊',ranges:[[4, 31]],
  label:"地球形成、定年與太陽系",basis:"地球形成與定年 p.4–13；太陽系及其運動 p.14–31。"
 },
 "2026-09-21":{
  subject:"物理",material:'123日的淬鍊',ranges:[[114, 127]],
  label:"電場、電位與基本電路",basis:"Chapter 4 前段：電作用、電場／電位與基本電路概念。"
 },
 "2026-09-22":{
  subject:"物理",material:'123日的淬鍊',ranges:[[128, 143]],
  label:"磁場、電磁感應與電磁波",basis:"Chapter 4 後段：磁場、感應、發電／馬達與電磁波。"
 },
 "2026-09-23":{
  subject:"生物",material:'123日的淬鍊',ranges:[[60, 63]],
  label:"孟德爾遺傳與機率",basis:"孟德爾遺傳、分離律、獨立分配與遺傳格。"
 },
 "2026-09-24":{
  subject:"生物",material:'123日的淬鍊',ranges:[[64, 71]],
  label:"延伸遺傳、伴性與家系圖",basis:"多等位基因、延伸遺傳、伴性與家系判讀。"
 },
 "2026-09-25":{
  subject:"化學",material:'123日的淬鍊',ranges:[[159, 171]],
  label:"沉澱、氧化還原與電化學",basis:"Chapter 4 後段：離子反應、氧化還原與相關電化學判讀。"
 },
 "2026-09-26":{
  subject:"地科",material:'123日的淬鍊',ranges:[[66, 93]],
  label:"地震波、地球內部與板塊構造",basis:"地震波與地球內部分層 p.66–73；板塊構造 p.74–80；地質作用、臺灣板塊與地震 p.81–93。"
 },
 "2026-09-28":{
  subject:"生物",material:'123日的淬鍊',ranges:[[80, 93]],
  label:"突變、基因調控與生物技術",basis:"基因表現延伸、突變及重組 DNA／生物技術。"
 },
 "2026-09-29":{
  subject:"生物",material:'123日的淬鍊',ranges:[[114, 121]],
  label:"演化證據與天擇",basis:"演化學說、天擇與現代演化觀點。"
 },
 "2026-09-30":{
  subject:"生物",material:'123日的淬鍊',ranges:[[120, 135]],
  label:"物種形成、分類與親緣樹",basis:"物種形成、分類、生物多樣性與親緣關係。"
 },
 "2026-10-01":{
  subject:"地科",material:'123日的淬鍊',ranges:[[114, 167]],
  label:"大氣結構、濕度與天氣系統",basis:"大氣 Chapter 3：分層、濕度、水氣、水平運動、颱風、降雨與氣象觀測。"
 },
 "2026-10-02":{
  subject:"地科",material:'123日的淬鍊',ranges:[[170, 209], [212, 250]],
  label:"海洋、潮汐、氣候與永續",basis:"海洋 Chapter 4＋氣候變遷與永續發展 Chapter 5。"
 },
 "2026-10-03":{
  subject:"化學",material:'123日的淬鍊',ranges:[[173, 227]],
  label:"有機、材料、能源與環境化學",basis:"Chapter 5：有機物、材料／界面活性劑、能源、水與空氣、綠色化學。"
 },
 "2026-10-05":{
  subject:"生物",material:'123日的淬鍊',ranges:[[4, 21], [24, 33], [58, 93], [112, 135]],
  label:"生物高風險整合：細胞→代謝→遺傳→演化",basis:"以已安排過的細胞、代謝、遺傳與演化核心頁做整合回顧。"
 },
 "2026-10-06":{
  subject:"化學",material:'123日的淬鍊',ranges:[[9, 20], [45, 83], [97, 128], [130, 171], [173, 227]],
  label:"化學主線：粒子→鍵結→反應→溶液→環境",basis:"依前面各化學主題的核心建議頁做總複習。"
 },
 "2026-10-07":{
  subject:"物理",material:'123日的淬鍊',ranges:[[220, 244]],
  label:"物理主線＋原子現象",basis:"優先補 Chapter 7 量子／原子現象，再以題目整合前面物理主線。"
 },
 "2026-10-08":{
  subject:"地科",material:'123日的淬鍊',ranges:[[4, 38], [66, 93], [114, 167], [170, 209], [212, 250]],
  label:"地球系統：天文→固體地球→大氣海洋→氣候",basis:"地科五大主線核心頁整合。"
 },
 "2026-10-19":{
  subject:"生物",material:'123日的淬鍊',ranges:[[4, 21]],
  label:"細胞結構→膜運輸→代謝整合",basis:"Chapter 1 前段的細胞結構、膜運輸與代謝核心頁。"
 },
 "2026-10-20":{
  subject:"化學",material:'123日的淬鍊',ranges:[[9, 20], [45, 83]],
  label:"粒子觀→原子→鍵結→物性",basis:"Chapter 1 粒子觀＋Chapter 2 原子結構、鍵結與物性。"
 },
 "2026-10-21":{
  subject:"物理",material:'123日的淬鍊',ranges:[[20, 55], [56, 113], [184, 199]],
  label:"受力→運動→能量與動量",basis:"交互作用、運動與機械能核心頁整合。"
 },
 "2026-10-22":{
  subject:"生物",material:'123日的淬鍊',ranges:[[24, 33], [74, 81]],
  label:"細胞週期→DNA→基因表現",basis:"細胞分裂與遺傳分子機制核心頁。"
 },
 "2026-10-23":{
  subject:"地科",material:'123日的淬鍊',ranges:[[4, 31], [66, 93]],
  label:"地球形成→定年→地震波與板塊",basis:"探索地球＋固體地球核心頁整合。"
 },
 "2026-10-26":{
  subject:"生物",material:'123日的淬鍊',ranges:[[28, 33], [60, 71], [84, 93]],
  label:"減數分裂→孟德爾→家系與生技",basis:"減數分裂、遺傳法則、延伸遺傳與生技核心頁。"
 },
 "2026-10-27":{
  subject:"化學",material:'123日的淬鍊',ranges:[[97, 128], [130, 171], [173, 227]],
  label:"反應守恆→水溶液→氧化還原與環境",basis:"Chapter 3–5 的反應、溶液、氧化還原與環境核心頁。"
 },
 "2026-10-28":{
  subject:"物理",material:'123日的淬鍊',ranges:[[114, 143], [144, 183], [220, 244]],
  label:"波→光→電磁→原子現象",basis:"電磁、波動與量子／原子現象核心頁整合。"
 },
 "2026-10-29":{
  subject:"地科",material:'123日的淬鍊',ranges:[[114, 167], [170, 209], [212, 250]],
  label:"大氣→海洋→氣候與永續",basis:"大氣、海洋與氣候變遷三大主線整合。"
 },
 "2026-10-30":{
  subject:"生物",material:'123日的淬鍊',ranges:[[80, 93], [112, 135]],
  label:"遺傳變異→天擇→演化與親緣",basis:"遺傳變異與演化、物種形成、親緣核心頁整合。"
 }
};

export const CALENDAR_GRAMMAR_PLAN: Record<string, GrammarPlanCandidate> = {"2026-08-20":{"title":"Ch.1 英文基本句型（1／2）","start":1,"end":6,"rangeText":"p.1–6","rangeType":"range","focus":"Vi／Vt；S＋Vi；S＋Vi＋SC；S＋Vt＋O"},"2026-08-22":{"title":"Ch.1 英文基本句型（2／2）","start":7,"end":11,"rangeText":"p.7–11","rangeType":"range","focus":"IO／DO、OC 與五大句型綜合辨識"},"2026-08-25":{"title":"Ch.2 動詞時態（1／3）","start":12,"end":17,"rangeText":"p.12–17","rangeType":"range","focus":"現在簡單式、進行式、完成式、完成進行式"},"2026-08-27":{"title":"Ch.2 動詞時態（2／3）","start":18,"end":22,"rangeText":"p.18–22","rangeType":"range","focus":"過去簡單式、進行式、完成式、完成進行式"},"2026-08-29":{"title":"Ch.2 動詞時態（3／3）","start":23,"end":27,"rangeText":"p.23–27","rangeType":"range","focus":"未來簡單式、進行式、完成式、完成進行式與其他時態要點"},"2026-09-01":{"title":"Ch.5 主詞與動詞一致（1／2）","start":64,"end":70,"rangeText":"p.64–70","rangeType":"range","focus":"主詞之後接單複數動詞的基本情形（一）～（三）"},"2026-09-03":{"title":"Ch.5 主詞與動詞一致（2／2）","start":71,"end":77,"rangeText":"p.71–77","rangeType":"range","focus":"依主詞意義與連接詞判斷單複數；關係子句配合"},"2026-09-05":{"title":"Ch.3 被動語態（1／3）","start":28,"end":33,"rangeText":"p.28–33","rangeType":"range","focus":"簡單式、進行式、完成式與助動詞的被動語態"},"2026-09-08":{"title":"Ch.3 被動語態（2／3）","start":34,"end":39,"rangeText":"p.34–39","rangeType":"range","focus":"不能被動的動詞、感官動詞、使役動詞與主動表被動"},"2026-09-10":{"title":"Ch.3 被動語態（3／3）＋Review 1","start":40,"end":47,"rangeText":"p.40–47","rangeType":"range","focus":"慣用被動、表客觀說法、by 片語省略與 Ch.1–3 回顧"},"2026-09-12":{"title":"Ch.4 助動詞（1／3）","start":48,"end":53,"rangeText":"p.48–53","rangeType":"range","focus":"do、have／has／had、shall／should／ought to"},"2026-09-15":{"title":"Ch.4 助動詞（2／3）","start":54,"end":58,"rangeText":"p.54–58","rangeType":"range","focus":"will／would、may／might、can／could"},"2026-09-17":{"title":"Ch.4 助動詞（3／3）","start":59,"end":63,"rangeText":"p.59–63","rangeType":"range","focus":"must、need／dare、used to／had better"},"2026-09-19":{"title":"Ch.10 不定詞（1／3）","start":143,"end":148,"rangeText":"p.143–148","rangeType":"range","focus":"不定詞作主詞、受詞、補語；疑問詞＋不定詞"},"2026-09-22":{"title":"Ch.10 不定詞（2／3）","start":149,"end":153,"rangeText":"p.149–153","rangeType":"range","focus":"不定詞作形容詞；作副詞表示目的與否定目的"},"2026-09-24":{"title":"Ch.10 不定詞（3／3）","start":154,"end":158,"rangeText":"p.154–158","rangeType":"range","focus":"結果用法、修飾形容詞與獨立不定詞片語"},"2026-09-26":{"title":"Ch.11 動名詞（1／2）","start":159,"end":166,"rangeText":"p.159–166","rangeType":"range","focus":"動名詞作主詞、補語、受詞；動名詞與不定詞比較"},"2026-09-29":{"title":"Ch.11 動名詞（2／2）","start":167,"end":173,"rangeText":"p.167–173","rangeType":"range","focus":"意義不同／相同的動詞搭配、介系詞 to＋V-ing、慣用語"},"2026-10-01":{"title":"Ch.12 分詞（1／3）","start":174,"end":179,"rangeText":"p.174–179","rangeType":"range","focus":"分詞的功用、情緒分詞、形容詞子句簡化"},"2026-10-03":{"title":"Ch.12 分詞（2／3）","start":180,"end":185,"rangeText":"p.180–185","rangeType":"range","focus":"同主詞副詞子句簡化：簡單、完成、被動、否定與保留連接詞"},"2026-10-06":{"title":"Ch.12 分詞（3／3）＋Review 4","start":186,"end":192,"rangeText":"p.186–192","rangeType":"range","focus":"不同主詞分詞構句、對等句簡化、with、複合形容詞與 Ch.10–12 回顧"},"2026-10-08":{"title":"Ch.7 名詞子句（1／2）","start":92,"end":97,"rangeText":"p.92–97","rangeType":"range","focus":"that 與 whether 名詞子句：主詞、受詞、補語、同位語"},"2026-10-10":{"title":"Ch.7 名詞子句（2／2）","start":98,"end":102,"rangeText":"p.98–102","rangeType":"range","focus":"wh- 疑問詞子句、wh-ever 子句與相關句型"},"2026-10-13":{"title":"Ch.8 形容詞子句（1／3）","start":103,"end":108,"rangeText":"p.103–108","rangeType":"range","focus":"關係代名詞作主格、受格、所有格；介系詞＋關係代名詞"},"2026-10-15":{"title":"Ch.8 形容詞子句（2／3）","start":109,"end":114,"rangeText":"p.109–114","rangeType":"range","focus":"限定／非限定用法、that、when／where／why／how"},"2026-10-20":{"title":"Ch.8 形容詞子句（3／3）","start":115,"end":120,"rangeText":"p.115–120","rangeType":"range","focus":"準關係代名詞、what／wh-ever 與形容詞子句簡化"},"2026-10-22":{"title":"Ch.9 副詞子句（1／3）","start":121,"end":127,"rangeText":"p.121–127","rangeType":"range","focus":"對等連接詞／連接詞組與表時間的連接詞"},"2026-10-24":{"title":"Ch.9 副詞子句（2／3）","start":128,"end":133,"rangeText":"p.128–133","rangeType":"range","focus":"表條件、原因與目的的連接詞"},"2026-10-27":{"title":"Ch.9 副詞子句（3／3）","start":134,"end":139,"rangeText":"p.134–139","rangeType":"range","focus":"表讓步與狀態的連接詞；副詞子句綜合判讀"},"2026-10-29":{"title":"Review 3（Ch.7–9）","start":140,"end":142,"rangeText":"p.140–142","rangeType":"range","focus":"名詞、形容詞與副詞子句混合複習＋訂正"},"2026-10-31":{"title":"Ch.6 假設語氣（1／2）","start":78,"end":83,"rangeText":"p.78–83","rangeType":"range","focus":"與現在、過去、未來事實相反；省略 if"},"2026-11-03":{"title":"Ch.6 假設語氣（2／2）＋Review 2","start":84,"end":91,"rangeText":"p.84–91","rangeType":"range","focus":"if only、as if、若非、建議／必要與省略 should；Ch.4–6 回顧"},"2026-11-05":{"title":"Ch.13 形容詞與副詞（1／3）","start":193,"end":200,"rangeText":"p.193–200","rangeType":"range","focus":"形容詞位置與用法；修飾可數／不可數名詞的數量形容詞"},"2026-11-07":{"title":"Ch.13 形容詞與副詞（2／3）","start":201,"end":208,"rangeText":"p.201–208","rangeType":"range","focus":"比較級／最高級構成；原級與比較級句型"},"2026-11-10":{"title":"Ch.13 形容詞與副詞（3／3）","start":209,"end":216,"rangeText":"p.209–216","rangeType":"range","focus":"最高級句型、副詞種類與形容詞／副詞搭配"},"2026-11-12":{"title":"Ch.14 代名詞（1／3）","start":217,"end":223,"rangeText":"p.217–223","rangeType":"range","focus":"人稱、反身與所有代名詞"},"2026-11-14":{"title":"Ch.14 代名詞（2／3）","start":224,"end":230,"rangeText":"p.224–230","rangeType":"range","focus":"指示代名詞與不定代名詞（一）"},"2026-11-17":{"title":"Ch.14 代名詞（3／3）","start":231,"end":237,"rangeText":"p.231–237","rangeType":"range","focus":"不定代名詞（二）、one／other／another 與疑問代名詞"},"2026-11-19":{"title":"Ch.15 否定句與倒裝句（1／3）","start":238,"end":243,"rangeText":"p.238–243","rangeType":"range","focus":"雙重否定、部分否定；否定副詞與 only 置首倒裝"},"2026-11-21":{"title":"Ch.15 否定句與倒裝句（2／3）","start":244,"end":249,"rangeText":"p.244–249","rangeType":"range","focus":"地方副詞、假設語氣、so／such…that 與主詞補語倒裝"},"2026-11-24":{"title":"Ch.15 否定句與倒裝句（3／3）","start":250,"end":254,"rangeText":"p.250–254","rangeType":"range","focus":"倒裝整合、感嘆句與附加問句"},"2026-11-26":{"title":"Review 5（Ch.13–15）","start":255,"end":null,"rangeText":"p.255 起","rangeType":"from","focus":"形容詞／副詞、代名詞、否定與倒裝綜合複習＋訂正"},"2026-11-28":{"title":"全冊總複習與錯題回收","start":1,"end":null,"rangeText":"全冊 Ch.1–15","rangeType":"whole","focus":"重做錯題；優先回收 be 動詞、時態／被動、to V／V-ing、三大子句與倒裝"}};
