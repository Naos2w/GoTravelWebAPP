# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.3.0] - 2026-09-26

### 🗺️ 地圖與搜尋引擎全面升級 (Map & Search Engine Modernization)

#### Added
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
  - **解決方案**：
    1. **單一確定性驗證流程 (`initAuth`)**：由 `getSession()` 作為初次唯一驗證來源，嚴格保留全螢幕載入狀態，在尚未確認登入狀態前絕不提前抹除 URL 參數或切換視圖。
    2. **解耦 `onAuthStateChange`**：忽略初次 `INITIAL_SESSION` 重複觸發，僅監聽後續 `SIGNED_IN`、`SIGNED_OUT`、`TOKEN_REFRESHED` 生命週期，徹底消滅競爭條件。
    3. **行程固定連結保護 (Permalinks)**：經由 `tripId` 成功載入行程後，網址列完整保留 `?tripId=...`，無論重新整理或複製分享皆能穩定停留在該行程詳情。
    4. **放寬資料庫逾時至 15 秒並清理計時器**：防止冷啟動查詢被提早中斷，並在已有行程快取時抑制背景同步的阻礙性錯誤卡片。
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
