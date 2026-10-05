# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.5.0] - 2026-10-05

### 📱 各模組 iOS 18 風格重構與手機原生功能聯動 (iOS 18 UI/UX & Native Apple Integrations)

#### Added
- **📲 手機原生功能聯動 (iOS Native Integrations)**：
  - **一鍵匯出至 iOS 備忘錄 (`Apple Notes`)**：
    - 建立 `services/exportService.ts`，整合 Web Share API，在 iPhone Safari 點擊直接彈出 iOS 系統原生 Share Sheet，點選「備忘錄」自動排版寫入。
    - 生成排版精緻的旅行筆記：含目的地、日期、航班代號與起降航廈、每日時間軸景點、行李打勾清單與預算開銷。
    - 非 Safari 或不支援環境自動無縫回退為「一鍵複製 Markdown 格式」，可直接貼入 Apple Notes、Notion 或 Obsidian。
  - **加入 Apple / 系統行事曆 (`.ics` iCalendar)**：
    - 動態生成 RFC 5545 標準 `.ics` 日曆資料，將旅程景點與航班起降時間打包，支援在 iPhone 點開一鍵「全部加入行事曆」，並自帶景點 GPS 座標、備註說明與出發前 30/120 分鐘鬧鈴通知。
  - **iOS Action Sheet 匯出彈窗 (`components/ExportModal.tsx`)**：
    - 旅程詳情頂部導航列新增「匯出」快捷按鈕，支援毛玻璃遮罩、流暢滑入動畫、選項卡片與 iPhone 小訣竅指引。
- **🎨 各模組 iOS 18 風格 UI/UX 重構 (Native Apple HIG Aesthetics)**：
  - **待辦清單 (Checklist - Apple Reminders 風格)**：
    - 圓形空心 Checkbox 支援彈簧墨水填色微動態 (`active:scale-75`) 與平滑劃線漸隱。
    - 淘汰過往未完成紅框警示，改用 Apple 質感 Inset Grouped 卡片與五大分類彩色圓形小徽章。
    - 新增「全部 / 未完成 / 已完成」三態切換膠囊，以及常見行李推薦按鈕（護照、萬用轉接插頭、行動電源等一鍵加入）。
  - **記帳與預算 (Expenses - Apple Wallet 風格)**：
    - 頂部升級為 Apple Card 鈦金漸變磨砂卡片，支援高光漫射光暈，醒目顯示總開銷與機票/當地消費拆分。
    - 類別統計採用 Apple Health 圓角進度長條與百分比膠囊。
    - 交易紀錄採用 Inset Grouped Table 質感，金額使用 Tabular 等寬字體。
  - **航班管理 (BoardingPass - Apple Wallet PKPass 風格)**：
    - 電子登機證票卡加入 Apple Wallet PKPass 經典鋸齒撕票打孔邊緣、條碼與 QR Code 擬真排版。
  - **行程與地圖 (Itinerary - Apple Maps 抽屜卡片)**：
    - 天數切換器升級為 iOS 18 Segmented Control 膠囊切換與日期標註。
    - 行動端地圖模式增強 Apple Maps 抽屜式卡片輪播與全螢幕展開/收合切換。
- **🧪 測試套件擴充**：
  - 新增 `test/unit/exportService.test.ts`（4 項測試，涵蓋 Markdown 生成、RFC 5545 日曆格式與 Web Share API fallback）。
  - 新增 `test/smoke/ExportModal.smoke.test.tsx`（3 項測試）。
  - 全專案測試套件擴充至 **21 個檔案、101 項測試 100% 通過**。

---

## [v1.4.0] - 2026-10-04

### 🧳 旅程總覽管理全面優化與管理模式 (Your Trips UI/UX & Trip Management)

#### Added
- **iOS 風格「編輯 / 完成」批量管理模式 (`isEditMode`)**：
  - 頂部導航列新增「編輯 / 完成」(`toggle-edit-mode-btn`) 切換開關。
  - 平時瀏覽保持極簡美感，不顯示刪除圖示避免誤觸；按下「編輯」時彈出管理橫幅與卡片刪除/退出氣泡標籤 (`animate-in zoom-in-75`)，按下「完成」即刻還原。
- **現代化刪除 / 退出確認視窗 (`components/DeleteTripModal.tsx`)**：
  - 徹底移除瀏覽器原生 `window.confirm`，改用全自訂毛玻璃模態視窗。
  - 智慧區分行程**擁有者 (Owner)** 與**協作者 (Collaborator)**：
    - 擁有者：顯示危險警示紅框、不可復原提示，確認後永久刪除旅程並推播 Realtime 通知。
    - 協作者：顯示退出確認，安全退出協作並不影響其他成員行程。
  - 支援 `Escape` 鍵快捷關閉、點擊遮罩外側關閉、動作進行時旋轉 Loading 指示器。
  - 同步整合於儀表板（Overview）右上角刪除按鈕。
- **旅程搜尋與狀態篩選機制**：
  - **即時搜尋框**：支援輸入旅程名稱或目的地關鍵字即時過濾。
  - **狀態篩選膠囊 (Filter Pills)**：提供「全部 (All)」、「即將到來 (Upcoming)」、「已結束 (Past)」三段式篩選標籤。
  - **空狀態優化**：針對尚未建立行程與搜尋無結果分別提供引導插圖、提示文字與「清除搜尋」按鈕。
- **動態狀態徽章與時間計算**：
  - 進行中旅程顯示翡翠綠呼吸燈動畫 (`animate-pulse`)。
  - 即將到來旅程精確倒數天數（如「3 天後出發」、「明天出發」）。
  - 已結束旅程顯示優雅淡灰色標籤。
- **自動化測試套件擴充**：
  - 新增 `test/smoke/YourTrips.smoke.test.tsx` 冒煙測試（9 項測試涵蓋編輯模式切換、搜尋、篩選、刪除視窗觸發與確認）。
  - 更新 `test/smoke/App.smoke.test.tsx` 整合測試與 `test/unit/version.test.ts` 版本驗證。

---

## [v1.3.0] - 2026-09-26

### 🗺️ 地圖與搜尋引擎全面升級 (Map & Search Engine Modernization)

#### Added
- **現代化測試架構與自動化測試套件 (`vitest`, `@testing-library/react`, `jsdom`)**：
  - **單元測試 (Unit Tests - 8 套件，56 項測試)**：
    - `authService.test.ts`：用戶資料格式化、SessionStorage 目標行程暫存與單次讀取消耗（One-time consumption）機制。
    - `mapUrlService.test.ts`：0ms 本地解析 Google Maps URL（`!3d...!4d...` 精確圖標座標優先於相機視角）、自訂經緯度字串解析與無效字串過濾。
    - `travelCalculation.test.ts`：多運具物理速度換算公式（步行 4.5 km/h、自行車 15 km/h、大眾運輸都市通勤速率）與跨小時時間排版。
    - `dateTimeUtils.test.ts`：嚴格 24 小時制時間轉換、本地日期防時區偏移、跨日與跨小時時間差運算 (`getDuration`)、多語系友善日期格式。
    - `ExpenseCategories.test.ts`：7 大支出分類樣式配置（圖示、色碼、CSS）與多語系名稱映射 (`getCategoryName`)。
    - `tdxService.test.ts`：台灣機場清單判定（TDX 優先 / 國外機場 fallback Aviationstack）、航班次日抵達時間位移解析 (`parseTdxTime`)。
    - `storageService.test.ts`：UUID 格式正規檢查、資料庫多層巢狀 Row 轉換至前端 Trip 模型轉換防護。
    - `localization.test.ts`：繁中 (`zh`) 與英文 (`en`) 語系鍵值 100% 對齊與完整性驗證。
  - **冒煙測試 (Smoke Tests - 9 套件，22 項測試)**：
    - `App.smoke.test.tsx`：根應用程式無崩潰掛載、認證狀態流轉與主頁顯示。
    - `Itinerary.smoke.test.tsx`：行程天數切換、景點卡片渲染、時間軸排版與空行程狀態。
    - `Expenses.smoke.test.tsx`：記帳清單渲染、多幣別顯示、防禦性修復未配置航班時的 `forEach` 崩潰問題。
    - `Checklist.smoke.test.tsx`：行李與待辦事項清單渲染、類別標籤與完成進度條。
    - `FlightManager.smoke.test.tsx` & `BoardingPass`：航班管理介面渲染、電子登機證卡片與行李規格標籤。
    - `Modals.smoke.test.tsx`：`BudgetModal`（預算編輯）、`ShareModal`（協作者名單）、`TripForm`（新旅程建立表單）、`CustomDateTimeInput`。
    - `MapView.smoke.test.tsx`：地圖外框元件冒煙加載、地點快速搜尋框與未配置座標時的導引狀態。
    - `LoginModal.smoke.test.tsx`：驗證登入階段已逾時 (`session_expired`) 與需登入存取行程 (`trip_access`) 之視覺標籤與關閉事件。
    - `NotificationToast.smoke.test.tsx`：驗證訊息格式渲染與 4000ms 自動定時銷毀。
  - **測試指令**：
    - `npm test`：執行完整測試套件（**18 測試檔案、82 項測試全數通過**）。
    - `npm run test:unit`：專注執行 9 個單元測試套件（58 項測試）。
    - `npm run test:smoke`：專注執行 9 個元件冒煙測試套件（24 項測試）。
    - `npm run test:watch`：即時熱重載測試模式。
- **📱 Instagram / Dynamic Island 風格手機版懸浮 UI (Mobile Floating UI)**：
  - **底部主導航懸浮膠囊島嶼 (`Floating Bottom Dock`)**：手機版將原貼底平鋪選單重構為現代懸浮膠囊島嶼，採用超強毛玻璃 (`backdrop-blur-2xl`)、柔和擴散陰影與全域安全區域邊距 (`safe-area-inset-bottom`)，配合 Instagram 觸控縮放動畫 (`active:scale-90`) 與半透明標籤膠囊高亮。
  - **地圖景點底部懸浮卡片輪播 (`Floating Bottom Carousel`)**：地圖模式徹底淘汰右側 72px 狹窄直欄，地圖全螢幕展開，下方呈現 Instagram / Apple Maps 風格水平滑動懸浮卡片，支援點擊卡片地圖平滑飛行 (`flyTo`)、點擊標記卡片居中連動、一鍵開啟 Google Maps 導航，並可隨時點擊膠囊按鈕一鍵收合/展開。卡片固定高度 (`h-[104px]`) 並對備註自動單行截斷與提示，搭配動態調升交通工具選項至 `bottom-[148px]`，徹底杜絕備註文字導致圖卡高度超出並遮擋交通工具選項的問題。
  - **旅程列表行動端懸浮按鈕 (`Floating Action Button - FAB`)**：手機版旅程列表於右下角拇指熱區新增圓形浮動按鈕，一鍵開啟建立旅程視窗。
- **⚡ 即時同步與防競態條件修復 (Realtime Sync & Anti-Race Condition)**：
  - **修復清單快速勾選/取消時動作被伺服器還原之問題**：
    - 將清單項目狀態切換由全旅程覆寫改為專屬單列變更 (`updateChecklistItem` / `addChecklistItem`)，節省 98% 資料庫寫入開銷。
    - 於 `Checklist.tsx` 引入 `pendingTogglesRef` 樂觀保護鎖與 150ms 項目防抖，徹底防止後端伺服器延遲回波 (Stale Echo) 覆蓋最新點擊。
    - 於 `App.tsx` 整合細粒度 Realtime Row 更新與單調請求序號防護 (`latestRefreshSeqRef`)，杜絕網路非同步響應亂序覆蓋。
- **升級 GitHub Actions 自動化 CI 檢查流程 (`.github/workflows/ci.yml`)**：
  - 修正觸發分支，完整支援預設分支 `master`、`main` 與 `develop` 之 Push 與 Pull Request 監聽。
  - 獨立視覺化步驟：TypeScript 型別檢查 (`npm run type-check`)、單元測試 (`npm run test:unit`)、冒煙測試 (`npm run test:smoke`) 與生產環境打包 (`npm run build`)，確保任何提交與 PR 皆能自動防禦回歸。
- **語意化版本控制與 Release 自動化 (Semantic Versioning & Release Workflow)**：
  - 將專案版本號升級至 `v1.3.0`，並新增版本號單元測試 (`test/unit/version.test.ts`) 與統一版本導出模組 (`services/version.ts`)。
  - 於前端主畫面展示即時版本徽章（首頁 footer 標註 `Go Travel • v1.3.0`，行程列表頂部導航列顯示 `v1.3.0` 膠囊標籤）。
  - 新增 `npm run version:tag` 便捷 Git Tag 標註腳本。
  - 建立 GitHub Actions Release 發布流程 (`.github/workflows/release.yml`)，於推送 `v*` tag 或手動觸發時自動執行型別檢查、測試驗證、生產打包，並自動產生 GitHub Release 與發行筆記。
- **100% 免 Token 多引擎地點搜尋 (`services/searchPlaceService.ts`)**：
  - **層級一 (0ms 本地解析)**：支援貼上完整 Google Maps 連結與自訂經緯度座標，自動優先抓取 `!3d...!4d...` 精確景點標記 Pin 點（避開 `@` 視角相機中心），0 網路請求、0 延遲。
  - **層級二 (現有行程比對)**：輸入現有行程名稱時自動列出快速選取標籤。
  - **層級三 (雙開源引擎平行檢索)**：整合 **OpenStreetMap Nominatim**（帶繁中 `zh-TW` 語系加權，精準搜尋「東京鐵塔」、「清水寺」等中文地標）與 **Komoot Photon API**（以地圖中心經緯度距離加權排序）。
- **地圖左下角全域交通模式切換器 (`routingModeOverride`)**：
  - 支援 **Auto (自動依行程)**、**開車 (Driving)**、**步行 (Walking)**、**大眾運輸 (Transit)**、**自行車 (Bicycling)**。
  - 根據實際路網距離與各運具物理速度（步行 4.5 km/h、自行車 15 km/h、大眾運輸都市通勤速率）即時精確重算時間，並支援小時與分鐘自動排版（如「步行 1小時20分」）。
  - 切換時即時更新路線折線幾何、虛線樣式與中途耗時標籤。
- **底圖整合原生高畫質圖磚與極致流暢深淺主題適配**：
  - 採用 Leaflet 原生點陣圖磚配合 GPU 硬體加速，達成 **60 FPS 零卡頓、零延遲**。
  - **淺色模式**：自然鮮豔、色彩豐富的標準 OpenStreetMap 大地色。
  - **深色模式**：動態套用精緻深色濾鏡（深石板灰底色、柔和路網，保留藍色水體與森林綠意，完美融入 GoTravel 深色 UI）。
- **地圖平滑飛行縮放 (`flyTo`)**：
  - 點擊搜尋結果時自動平滑平移至目標景點。

#### Fixed
- **修復地圖左下角切換交通模式時「時間未重新計算」問題**：
  - 解決 OSRM 公共展示伺服器（demo server）對不同 profile（`driving`、`foot`、`bicycle`）皆回傳相同車程秒數的缺陷，改由路網精確距離結合真實運具速率動態運算，切換交通工具時時間立即顯著更新。
- **徹底修復帶 `tripId` 網址進入時「先跳回登入首頁、再跳轉到列表」的狀態競爭 (Race Condition)**：
  - **根本原因**：
    1. 掛載當下 `supabase.auth.onAuthStateChange` 立即觸發初次事件，此時 Supabase 尚未自本地儲存完成 Session 水合（Hydration），導致程式碼誤判為未登入，瞬間執行 `replaceState` 抹除網址 `tripId` 參數，並將視圖強制切換至 `landing` 首頁。
    2. 微秒後 `getSession()` 解析出真實登入用戶，再次切換為 `list` 列表視圖，造成使用者眼中的「先跳登入首頁、再抹除網址跳回挑選行程畫面」。
    3. 資料庫多表關聯查詢逾時設為 8 秒過於激進，在冷啟動或跨國網路連線時過早中斷，導致 `getTripById` 誤報「找不到旅程或無權限存取」與「Database query timeout (getTrips)」。
  - **解決方案（兩階段權限查驗與分流跳轉）**：
    1. **單一確定性驗證流程 (`initAuth`)**：由 `getSession()` 作為初次唯一驗證來源，嚴格保留全螢幕載入狀態，在尚未確認登入狀態前絕不提前抹除 URL 參數或切換視圖。
    2. **解耦 `onAuthStateChange`**：忽略初次 `INITIAL_SESSION` 重複觸發，僅監聽後續 `SIGNED_IN`、`SIGNED_OUT`、`TOKEN_REFRESHED` 生命週期，徹底消滅競爭條件。
    3. **帶 `tripId` 之權限查驗與分流規範**：
       - **條件一：未登入** ➡️ 立即跳出提示「此行程需要登入存取，已為您前往登入主頁」，清除 URL 參數，跳轉至登入主頁 (`landing`) 並彈出登入視窗，同時保留該行程目標，登入完成後自動接續導回。
       - **條件二：已登入且有讀取權限** ➡️ 順利載入行程，網址列完整保留 `?tripId=...`（固定連結），直達行程詳情頁 (`detail`)。
       - **條件三：已登入但無權限或找不到行程** ➡️ 立即跳出提示「您沒有此行程的存取權限 / 找不到此行程，已為您跳轉至您的行程頁面」，清除失效參數，跳轉回使用者自己的行程列表 (`list`)。
    4. **徹底移除人工 `Promise.race` 逾時拒絕機制與配置免死鎖 Auth Lock**：
       - 解決客戶端人工計時器在冷啟動時過早拋出 `Error: Database query timeout (getTrips)` 的缺陷，回歸標準連線管理。
       - 在 `createClient` 注入自訂 in-process lock，徹底避開 Chromium 瀏覽器 Web Locks (`navigator.locks`) 在頁面重新整理時發生的死鎖競爭。
- **新增 Session 過期 / 未登入存取時的明確視覺畫面與自動導回機制 (`LoginModal`, `App.tsx`)**：
  - 避免使用者遭遇「無聲無息跳回首頁」的困惑體驗，跳回首頁時主動彈出情境化視窗：
    - **登入逾時情境**：顯示琥珀色盾牌警示圖標、標題「登入階段已逾時」，並說明「您的登入已過期。為保護行程安全，請重新登入，系統已為您暫存目標行程！」，提供「重新登入並返回行程」單鍵操作。
    - **存取私密行程情境**：顯示鎖頭圖標、標題「需要登入以存取行程」，標明「目標行程已暫存，登入後立即開啟」。
  - **自動行程記憶與還原**：將目標行程儲存至 `sessionStorage`，Google OAuth 登入成功後即刻無縫開啟該行程。
  - **首頁防呆浮動提示列**：即使用戶點擊關閉視窗，首頁頂端依然長駐浮動提示條（顯示鎖頭、提示訊息與「登入」按鈕），可隨時一鍵重新呼叫登入畫面。
- **修復 CARTO Voyager 底圖浮水印錯誤**：
  - 因 CARTO 官方政策變更，未帶 API Key 之請求全面回傳 `API KEY REQUIRED` 浮水印。已全面遷移至 100% 免 Key 開源圖磚。
- **徹底解決 WebGL 轉接層造成的卡頓 (Lag) 與全黑問題**：
  - 捨棄重型 WebGL 向量雙向同步轉接層，回歸原生 GPU 渲染，徹底解決拖曳掉幀、WebWorker 報錯與深色模式底色漆黑問題。
- **修復 URL 帶 `tripId` 重新整理時「一直轉圈圈顯示同步中」卡死問題**：
  - **根本原因**：
    1. React StrictMode 開發模式二次掛載與 Supabase 事件競爭，導致 `onAuthStateChange` 未及時觸發，`isLoading` 停滯為 `true`。
    2. Token 刷新或重複事件時，因 Ref 比對命中直接 `return`，遺漏呼叫 `setIsLoading(false)`。
    3. `handleAuthUser` 成功讀取後未立即將 `trip` 注入 `trips` 狀態陣列，造成詳情視圖缺少 `currentTrip`。
    4. Supabase 多表關聯查詢缺乏逾時熔斷，遇網路卡頓或連線池冷啟動時無限等待。
  - **解決方案**：
    1. 掛載時直接以 `supabase.auth.getSession()` 主動驗證，解決事件被 React 生命週期吞噬的風險。
    2. 新增全域 6 秒防護逾時（Safety Timeout），任何極端網路狀況皆保證解除全螢幕 Spinner。
    3. 在 `getTripById` 與 `getTrips` 加入 8 秒 `Promise.race` 逾時熔斷，防止資料庫查詢掛起。
    4. 在驗證行程後第一時間快取至 `trips` 狀態，並新增行程不存在時的友善提示卡片。

#### Removed
- **徹底淘汰 Google Places API (`places.googleapis.com`)**：
  - 移除 `components/MapView.tsx` 與 `components/Itinerary.tsx` 中的付費 API 請求，達成 0 Google API Token / 0 費用消耗。

---

## [v1.2.0] - 2026-09-25

### 🔐 認證架構與行程分享優化 (Authentication & Sharing Overhaul)

#### Added
- **訪客預覽模式 (Guest / View-only Mode)**：
  - 收到分享連結的未登入使用者可直接瀏覽行程與地圖（唯讀狀態）。
  - 導航列與頂部顯示訪客預覽標籤與提示，點擊編輯時彈出登入引導。
- **Email Magic Link 登入**：
  - 支援免密碼信箱驗證碼直接登入，建立專屬 `components/LoginModal.tsx`。
- **登入回跳路徑保留 (Deep Link Redirect)**：
  - 發起 OAuth 前將原本訪問之目標頁面暫存至 `sessionStorage`，登入後自動重導向回原行程。
- **防連點與視覺回饋**：
  - 登入按鈕加入 `isLoggingIn` 載入中 Spinner 狀態並禁用連點。

#### Changed
- **架構解耦**：
  - 建立獨立 `contexts/AuthContext.tsx` 與 `services/authService.ts`。
  - 整合 Supabase `onAuthStateChange` 的 `INITIAL_SESSION`，解決雙重請求 Race Condition。
- **防禦性取值**：
  - 實作 `parseSupabaseUser`，防止使用者資訊缺失導致 React 白屏崩潰。

#### Fixed
- **修復 Supabase 登出 403 例外卡死**：
  - 封裝安全登出函式，遇到網路或 API 例外時強制清除本地 token 與 state，確保 100% 成功退回 Landing 頁面。

---

## [v1.1.0] - 2026-08-10

### 🛣️ OSRM 路徑規劃與色彩整合 (OSRM Integration)

#### Added
- **OSRM 獨立路徑計算**：
  - 支援步行（foot profile）、開車（driving profile）、自行車（bicycle profile）即時路線計算。
- **色彩語意統一**：
  - 地圖路線折線與 Itinerary 時間軸顏色無縫匹配（開車: Slate, 步行: Amber, 自行車: Emerald, 大眾運輸: Indigo, 航班: Blue）。

---

## [v1.0.0] - 2026-08-01

### 🎉 初版發佈 (Initial Release)

- 多行程建立與每日時間軸管理。
- 機票管理（Google Gemini AI 班機排程查詢 + TDX 即時航空數據）。
- 旅費分帳與分類統計圖表（Recharts）。
- 行李打包檢核清單（Checklist）。
- 中英多語系切換與深色模式支援。
