# Go Travel

Go Travel is a comprehensive travel planning application designed to help you organize every aspect of your trips. From itinerary planning and expense tracking to flight management and packing checklists, Go Travel provides a seamless experience for modern travelers.

## 🌟 Features

*   **Trip Management**: Create and manage multiple trips with ease.
*   **Smart Itinerary**: Plan your daily activities and keep track of your schedule.
*   **Flight Manager**: Manage flight details with AI-powered schedule lookup (powered by Google Gemini) and real-time data integration (via TDX).
*   **Expense Tracker**: Monitor your travel budget and track expenses by category.
*   **Interactive Checklist**: Ensure you never forget essential items with a customizable packing list.
*   **Multi-language Support**: Available in English and Traditional Chinese (繁體中文).
*   **Theme Customization**: Switch between Light and Dark modes for comfortable viewing.
*   **Cloud Sync**: Your data is securely stored and synced using Supabase.

## 🛠️ Tech Stack

*   **Frontend**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), [TypeScript](https://www.typescriptlang.org/)
*   **UI Components**: [Lucide React](https://lucide.dev/) (Icons), [Recharts](https://recharts.org/) (Data Visualization)
*   **AI Integration**: [Google GenAI SDK](https://ai.google.dev/) (Gemini 3 Pro/Flash)
*   **Backend & Storage**: [Supabase](https://supabase.com/)
*   **External APIs**: [TDX](https://tdx.transportdata.tw/) (Transport Data eXchange)

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
    Create a `.env` or `.env.local` file in the root directory and add the following environment variables:

    ```env
    # Google Gemini AI
    GEMINI_API_KEY=your_gemini_api_key

    # Google Auth (if used)
    GOOGLE_CLIENT_ID=your_google_client_id

    # TDX API (Transport Data)
    TDX_CLIENT_ID=your_tdx_client_id
    TDX_CLIENT_SECRET=your_tdx_client_secret

    # Supabase Configuration
    VITE_SUPABASE_URL=your_supabase_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run the development server**
    ```bash
    npm run dev
    ```

5.  **Build for production**
    ```bash
    npm run build
    ```

## 📖 Usage

1.  **Create a Trip**: Click on "New" or "新增" to start planning a new journey.
2.  **Add Flights**: Use the Flight Manager to add your flight details. You can use the AI feature to look up flight schedules automatically.
3.  **Plan Itinerary**: Go to the "Itinerary" tab to add activities for each day of your trip.
4.  **Track Expenses**: Log your spending in the "Expenses" tab to stay within budget.
5.  **Prepare**: Use the "Checklist" to mark off items as you pack.

## 📄 License

[MIT](LICENSE)
