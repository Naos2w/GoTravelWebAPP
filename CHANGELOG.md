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
  - 切換時即時向 OSRM 重新發送請求，動態更新路線折線幾何（Polyline）與中途耗時標籤。
- **底圖整合 OpenFreeMap Bright 向量圖磚**：
  - 引入 `maplibre-gl` 與 `@maplibre/maplibre-gl-leaflet` 轉接層，支援高解析度向量渲染。
- **地圖平滑飛行縮放 (`flyTo`)**：
  - 點擊搜尋結果時自動平滑平移至目標景點。

#### Fixed
- **修復 CARTO Voyager 底圖浮水印錯誤**：
  - 因 CARTO 官方政策變更，未帶 API Key 之請求全面回傳 `API KEY REQUIRED` 浮水印。已將圖磚服務全面遷移至開源免 Key 方案。
- **修復 MapLibre WebWorker 在 Vite 環境下載入失敗黑畫面問題**：
  - 透過 Vite 的 `?worker&url` 語法注入 `setWorkerUrl(maplibreWorkerUrl)`，在建置時生成獨立 worker chunk。
  - 在 `OpenFreeMapLayer` 中加入安全防禦監聽，若遇到 WebGL 或 Worker 異常自動降級至 OpenStreetMap 標準圖磚。
- **修復深色模式下底圖反黑問題**：
  - 移除深色模式強制切換 `styles/dark` 邏輯，固定採用明亮高對比的 **OpenFreeMap Bright** 亮色風格。

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
