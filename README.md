# Go Travel

Go Travel is a modern, comprehensive travel planning web application designed to help you organize every aspect of your journeys. From smart interactive itineraries and mode-aware map routing to zero-token place search, AI-assisted flight management, expense tracking, and packing checklists, Go Travel provides a seamless experience for modern travelers.

## 🌟 Features

*   **🗺️ Interactive Map & Mode-Aware Routing (OSRM)**:
    *   Visualize daily itineraries on an interactive Leaflet map.
    *   Route calculation powered by Open Source Routing Machine (OSRM) supporting 4 travel modes: **Driving** (開車), **Walking** (步行), **Bicycling** (自行車), and **Transit** (大眾運輸).
    *   Automatic mid-stop travel duration and distance estimation with matching visual markers.
*   **🔍 100% Free Multi-Engine Place Search (Zero Google API Tokens)**:
    *   **Instant URL & Coordinates Resolution**: Paste full Google Maps URLs or latitude/longitude coordinates to instantly lock onto exact POI pins (`!3d...!4d...`) with 0ms delay and 0 API cost.
    *   **Komoot Photon + OSM Nominatim Integration**: Real-time parallel search engine with map viewport bias and multilingual support (including Traditional Chinese landmarks like "東京鐵塔", "清水寺").
*   **🔐 Flexible Authentication & Guest Preview**:
    *   Supports Google OAuth and passwordless **Email Magic Link** login.
    *   **Guest / View-only Mode**: Share trip links with friends or family allowing them to preview trips without requiring an account.
    *   Deep linking preserves the user's intended destination page after logging in.
*   **✈️ Flight Manager**:
    *   Manage flights with AI-powered schedule lookup (powered by Google Gemini) and real-time flight data integration (via TDX & AviationStack).
*   **📅 Smart Daily Itinerary**:
    *   Drag-and-drop reordering with automatic travel time recalculation.
    *   Categorize activities into Places, Food, and Transports.
*   **💰 Expense Tracker**:
    *   Monitor travel budgets and track expenses with interactive category breakdown charts.
*   **🎒 Interactive Checklist**:
    *   Customizable packing checklist with category filters and completion tracking.
*   **🌐 Multi-language & Dark Mode**:
    *   English and Traditional Chinese (繁體中文) support.
    *   Responsive, sleek design with full Dark Mode support.
*   **☁️ Cloud Sync & Optimistic UI**:
    *   Secure data sync backed by Supabase with instant optimistic local updates.

## 🛠️ Tech Stack

*   **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS](https://tailwindcss.com/)
*   **Mapping & Routing**: [Leaflet](https://leafletjs.com/), [React Leaflet](https://react-leaflet.js.org/), [OSRM](https://project-osrm.org/)
*   **Geocoding & Search**: [Komoot Photon](https://photon.komoot.io/), [OpenStreetMap Nominatim](https://nominatim.org/), Client-side Google Maps URL Parser
*   **UI Components & Icons**: [Lucide React](https://lucide.dev/), [Recharts](https://recharts.org/)
*   **AI Integration**: [Google GenAI SDK](https://ai.google.dev/) (Gemini AI)
*   **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL & Supabase Auth)
*   **External APIs**: [TDX](https://tdx.transportdata.tw/) (Transport Data eXchange), [AviationStack](https://aviationstack.com/)

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or higher)
*   npm or yarn

### Installation

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd go-travel
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Configuration**
    Create a `.env.local` file in the root directory:

    ```env
    # Supabase (Required for Auth & Data Storage)
    VITE_SUPABASE_URL=https://your-project.supabase.co
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

    # Google Gemini AI (Optional: for AI flight lookup & assistant)
    VITE_GEMINI_API_KEY=your_gemini_api_key

    # Google OAuth Client ID (Optional: for Google Login)
    VITE_GOOGLE_CLIENT_ID=your_google_client_id

    # Flight APIs (Optional: for real-time flight tracking)
    VITE_TDX_CLIENT_ID=your_tdx_client_id
    VITE_TDX_CLIENT_SECRET=your_tdx_client_secret
    VITE_AVIATIONSTACK_ACCESS_KEY=your_aviationstack_key

    # Note: Google Maps API Key is NOT required!
    # Place search & routing are 100% free via Photon, Nominatim, and OSRM.
    ```

4.  **Run the development server**
    ```bash
    npm run dev
    ```

5.  **Build for production**
    ```bash
    npm run build
    ```

## 📖 Usage Highlights

1.  **Adding Places with Free Search**:
    *   In the Map view or Itinerary editor, type any landmark or place name (e.g. `清水寺`, `Tokyo Tower`, `Schloss Laufen`) to search without consuming Google API quota.
    *   Alternatively, copy and paste a full Google Maps URL directly into the search bar or place name input. The exact coordinates and place name will be automatically extracted.
2.  **Mode-Aware Travel Times**:
    *   Click the travel mode toggle (Car, Walk, Bicycle, Transit) between itinerary items to recalculate route geometry and transit durations automatically via OSRM.
3.  **Collaborating & Sharing**:
    *   Share the trip URL directly with companions. Unregistered users can view the itinerary in Read-only Guest Mode, while registered users can join and edit.

## 📄 License

[MIT](LICENSE)
