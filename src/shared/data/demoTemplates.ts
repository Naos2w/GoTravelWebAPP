import {
  ChecklistItem,
  Currency,
  DayPlan,
  Expense,
  FlightInfo,
  ItineraryItem,
  Language,
  TransportType,
  Trip,
} from "../../types";

export interface BilingualText {
  zh: string;
  en: string;
}

export interface TemplateStop {
  time: string;
  placeName: BilingualText;
  lat: number;
  lng: number;
  type: "Place" | "Transport" | "Food";
  transportType?: TransportType;
  note?: BilingualText;
  googleMapsUrl?: string;
}

export interface TemplateDay {
  dayNumber: number;
  title: BilingualText;
  stops: TemplateStop[];
}

export interface TemplateFlightSummary {
  airline: string;
  airlineID: string;
  airlineNameZh: string;
  airlineNameEn: string;
  outboundFlightNumber: string;
  inboundFlightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  outboundDepTime: string;
  outboundArrTime: string;
  inboundDepTime: string;
  inboundArrTime: string;
  terminalOut: string;
  terminalIn: string;
  cabinClass: string;
  priceTwd: number;
}

export interface TemplateExpenseSeed {
  dayOffset: number;
  amount: number;
  currency: Currency;
  exchangeRate: number;
  category: Expense["category"];
  note: BilingualText;
}

export interface TemplateChecklistSeed {
  text: BilingualText;
  category: ChecklistItem["category"];
  isCompleted?: boolean;
}

export interface TripTemplate {
  id: string;
  name: BilingualText;
  subtitle: BilingualText;
  destination: BilingualText;
  region: BilingualText;
  days: number;
  nights: number;
  currency: Currency;
  estimatedBudgetTwd: number;
  tags: { zh: string[]; en: string[] };
  accentTone: "blue" | "amber" | "green";
  flight: TemplateFlightSummary;
  itinerary: TemplateDay[];
  expenses: TemplateExpenseSeed[];
  checklist: TemplateChecklistSeed[];
}

export const CURATED_TRIP_TEMPLATES: TripTemplate[] = [
  {
    id: "tokyo-3d",
    name: {
      zh: "東京 3 日精華散步",
      en: "Tokyo 3-Day City Walk",
    },
    subtitle: {
      zh: "淺草下町、teamLab 沉浸光影、築地海鮮與澀谷高空夜景，三天走透經典東京。",
      en: "Historic Asakusa, teamLab art, Tsukiji morning bites, Meiji Jingu, and Shibuya skyline views in three balanced days.",
    },
    destination: {
      zh: "日本東京",
      en: "Tokyo, Japan",
    },
    region: {
      zh: "東亞 · 日本",
      en: "East Asia · Japan",
    },
    days: 3,
    nights: 2,
    currency: Currency.JPY,
    estimatedBudgetTwd: 28500,
    tags: {
      zh: ["都市散步", "經典美食", "新手首選"],
      en: ["City Walk", "Iconic Food", "First-Timer"],
    },
    accentTone: "blue",
    flight: {
      airline: "STARLUX Airlines",
      airlineID: "JX",
      airlineNameZh: "星宇航空",
      airlineNameEn: "STARLUX Airlines",
      outboundFlightNumber: "JX800",
      inboundFlightNumber: "JX801",
      departureAirport: "TPE",
      arrivalAirport: "NRT",
      outboundDepTime: "08:30",
      outboundArrTime: "12:45",
      inboundDepTime: "14:00",
      inboundArrTime: "16:45",
      terminalOut: "T1",
      terminalIn: "T2",
      cabinClass: "Economy",
      priceTwd: 13800,
    },
    itinerary: [
      {
        dayNumber: 1,
        title: {
          zh: "抵達成田與淺草下町夕陽",
          en: "Arrival & Asakusa Heritage Walk",
        },
        stops: [
          {
            time: "13:30",
            placeName: {
              zh: "成田特快 N'EX 前往東京市區",
              en: "Narita Express (N'EX) to Central Tokyo",
            },
            lat: 35.772,
            lng: 140.3929,
            type: "Transport",
            transportType: "Public",
            note: {
              zh: "於成田機場 B1 換乘直達東京／澀谷。",
              en: "Board at Narita Airport B1 for direct transfer to Tokyo/Shibuya.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.7720,140.3929",
          },
          {
            time: "15:30",
            placeName: {
              zh: "淺草寺與雷門仲見世通",
              en: "Senso-ji Temple & Nakamise Street",
            },
            lat: 35.7148,
            lng: 139.7967,
            type: "Place",
            note: {
              zh: "從雷門步行至本堂參拜，避開正午人潮。",
              en: "Walk through Kaminarimon Gate to the main hall in soft afternoon light.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.7148,139.7967",
          },
          {
            time: "17:45",
            placeName: {
              zh: "東京晴空塔展望台",
              en: "Tokyo Skytree Observation Deck",
            },
            lat: 35.7101,
            lng: 139.8107,
            type: "Place",
            note: {
              zh: "傍晚登塔同時捕捉暮色富士山與東京夜景。",
              en: "Head up before sunset for twilight Mt. Fuji silhouettes and city lights.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.7101,139.8107",
          },
          {
            time: "19:30",
            placeName: {
              zh: "淺草今半壽喜燒晚餐",
              en: "Asakusa Imahan Sukiyaki Dinner",
            },
            lat: 35.7123,
            lng: 139.7924,
            type: "Food",
            note: {
              zh: "建議提前兩週線上預約黑毛和牛套餐。",
              en: "Reserve two weeks ahead for the classic Wagyu sukiyaki course.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.7123,139.7924",
          },
        ],
      },
      {
        dayNumber: 2,
        title: {
          zh: "築地早市、teamLab 與澀谷夜色",
          en: "Tsukiji, teamLab Planets & Shibuya Sky",
        },
        stops: [
          {
            time: "08:30",
            placeName: {
              zh: "築地場外市場海鮮早餐",
              en: "Tsukiji Outer Market Breakfast",
            },
            lat: 35.6655,
            lng: 139.7707,
            type: "Food",
            note: {
              zh: "品嚐現烤玉子燒、鮪魚海鮮丼與焙茶拿鐵。",
              en: "Sample fresh tamagoyaki, tuna donburi, and roasted green tea latte.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.6655,139.7707",
          },
          {
            time: "11:00",
            placeName: {
              zh: "teamLab Planets TOKYO",
              en: "teamLab Planets TOKYO",
            },
            lat: 35.6491,
            lng: 139.7898,
            type: "Place",
            note: {
              zh: "穿方便捲起褲管的服裝，涉水展區需赤腳入場。",
              en: "Wear trousers easy to roll up for the barefoot water installations.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.6491,139.7898",
          },
          {
            time: "16:30",
            placeName: {
              zh: "澀谷 SHIBUYA SKY 露天展望台",
              en: "SHIBUYA SKY Rooftop Observatory",
            },
            lat: 35.6584,
            lng: 139.7022,
            type: "Place",
            note: {
              zh: "預約日落前 40 分鐘場次，俯瞰十字路口車潮。",
              en: "Book a slot 40 minutes before sunset overlooking Shibuya Crossing.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.6584,139.7022",
          },
          {
            time: "19:30",
            placeName: {
              zh: "澀谷炭火燒肉晚餐",
              en: "Shibuya Charcoal Yakiniku Dinner",
            },
            lat: 35.6595,
            lng: 139.7004,
            type: "Food",
            note: {
              zh: "逛完宮下公園後步行前往享用和牛燒肉。",
              en: "Walk over from Miyashita Park for late-evening Wagyu grill.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.6595,139.7004",
          },
        ],
      },
      {
        dayNumber: 3,
        title: {
          zh: "明治神宮晨間森林與返程",
          en: "Meiji Jingu Morning & Departure",
        },
        stops: [
          {
            time: "08:45",
            placeName: {
              zh: "明治神宮參道散步",
              en: "Meiji Jingu Shrine Forest Walk",
            },
            lat: 35.6764,
            lng: 139.6993,
            type: "Place",
            note: {
              zh: "早晨人煙稀少，感受市中心百公頃森林靜謐氣息。",
              en: "Quiet morning walk beneath towering cedars in central Tokyo.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.6764,139.6993",
          },
          {
            time: "10:15",
            placeName: {
              zh: "表參道手沖咖啡早午餐",
              en: "Omotesando Specialty Coffee Brunch",
            },
            lat: 35.6652,
            lng: 139.7123,
            type: "Food",
            note: {
              zh: "輕鬆享用單品手沖與可頌，順道採買伴手禮。",
              en: "Pour-over coffee, flaky pastries, and final souvenir pickups.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.6652,139.7123",
          },
          {
            time: "11:45",
            placeName: {
              zh: "前往成田國際機場第二航廈",
              en: "Transfer to Narita Airport Terminal 2",
            },
            lat: 35.772,
            lng: 140.3929,
            type: "Transport",
            transportType: "Flight",
            note: {
              zh: "預留 2 小時辦理登機手續與免稅採買。",
              en: "Allow 2 hours for check-in, security, and duty-free shopping.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.7720,140.3929",
          },
        ],
      },
    ],
    expenses: [
      {
        dayOffset: 0,
        amount: 5000,
        currency: Currency.JPY,
        exchangeRate: 0.215,
        category: "Transport",
        note: { zh: "N'EX 來回票與 Suica 儲值", en: "N'EX ticket & Suica top-up" },
      },
      {
        dayOffset: 0,
        amount: 46000,
        currency: Currency.JPY,
        exchangeRate: 0.215,
        category: "Accommodation",
        note: { zh: "澀谷精品旅宿 2 晚", en: "Shibuya boutique hotel (2 nights)" },
      },
      {
        dayOffset: 0,
        amount: 14500,
        currency: Currency.JPY,
        exchangeRate: 0.215,
        category: "Food",
        note: { zh: "淺草今半壽喜燒晚餐", en: "Asakusa Imahan sukiyaki dinner" },
      },
      {
        dayOffset: 1,
        amount: 3800,
        currency: Currency.JPY,
        exchangeRate: 0.215,
        category: "Food",
        note: { zh: "築地市場海鮮丼與小吃", en: "Tsukiji seafood bowl & snacks" },
      },
      {
        dayOffset: 1,
        amount: 4200,
        currency: Currency.JPY,
        exchangeRate: 0.215,
        category: "Tickets",
        note: { zh: "teamLab Planets 電子門票", en: "teamLab Planets admission" },
      },
    ],
    checklist: [
      {
        text: { zh: "護照與 Visit Japan Web QR 碼", en: "Passport & Visit Japan Web QR code" },
        category: "Documents",
        isCompleted: true,
      },
      {
        text: { zh: "Apple Pay 綁定 Suica 交通卡", en: "Add Suica transit card to Apple Wallet" },
        category: "Documents",
        isCompleted: true,
      },
      {
        text: { zh: "日本 5G eSIM 開通設定", en: "Activate Japan 5G eSIM profile" },
        category: "Gear",
        isCompleted: false,
      },
      {
        text: { zh: "行動電源與 Type-C 快充線", en: "Power bank & USB-C fast charging cable" },
        category: "Gear",
        isCompleted: false,
      },
      {
        text: { zh: "好走耐穿的每日步行鞋", en: "Comfortable all-day walking shoes" },
        category: "Clothing",
        isCompleted: false,
      },
      {
        text: { zh: "輕量折疊傘與隨身購物袋", en: "Compact umbrella & foldable tote bag" },
        category: "Other",
        isCompleted: false,
      },
    ],
  },
  {
    id: "kansai-4d",
    name: {
      zh: "京阪 4 日古都美食",
      en: "Kyoto & Osaka 4-Day Heritage",
    },
    subtitle: {
      zh: "清水寺、伏見稻荷、嵐山竹林串連大阪道頓堀夜市，兼顧千年古都靜謐與關西庶民美味。",
      en: "Kiyomizu-dera, Fushimi Inari, and Arashiyama bamboo paths paired with Osaka's lively Dotonbori food streets.",
    },
    destination: {
      zh: "日本京都・大阪",
      en: "Kyoto & Osaka, Japan",
    },
    region: {
      zh: "東亞 · 關西",
      en: "East Asia · Kansai",
    },
    days: 4,
    nights: 3,
    currency: Currency.JPY,
    estimatedBudgetTwd: 34000,
    tags: {
      zh: ["古都寺社", "京都抹茶", "大阪美食"],
      en: ["Temples", "Matcha", "Street Food"],
    },
    accentTone: "amber",
    flight: {
      airline: "EVA Air",
      airlineID: "BR",
      airlineNameZh: "長榮航空",
      airlineNameEn: "EVA Air",
      outboundFlightNumber: "BR132",
      inboundFlightNumber: "BR131",
      departureAirport: "TPE",
      arrivalAirport: "KIX",
      outboundDepTime: "08:30",
      outboundArrTime: "12:10",
      inboundDepTime: "13:10",
      inboundArrTime: "15:05",
      terminalOut: "T2",
      terminalIn: "T1",
      cabinClass: "Economy",
      priceTwd: 14500,
    },
    itinerary: [
      {
        dayNumber: 1,
        title: {
          zh: "前進京都、錦市場與清水寺暮色",
          en: "Kyoto Arrival, Nishiki Market & Kiyomizu-dera",
        },
        stops: [
          {
            time: "13:15",
            placeName: {
              zh: "JR HARUKA 關西機場特急前往京都",
              en: "JR HARUKA Express to Kyoto Station",
            },
            lat: 34.432,
            lng: 135.2304,
            type: "Transport",
            transportType: "Public",
            note: {
              zh: "約 75 分鐘直達京都車站，先至飯店寄放行李。",
              en: "75-minute direct ride to Kyoto Station; drop luggage at hotel.",
            },
            googleMapsUrl: "https://maps.google.com/?q=34.4320,135.2304",
          },
          {
            time: "15:00",
            placeName: {
              zh: "京都錦市場小吃巡禮",
              en: "Nishiki Market Food Stroll",
            },
            lat: 35.005,
            lng: 135.7649,
            type: "Food",
            note: {
              zh: "豆乳甜甜圈、抹茶霜淇淋與現烤鰻魚串。",
              en: "Try soy milk donuts, matcha soft-serve, and grilled eel skewers.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.0050,135.7649",
          },
          {
            time: "16:30",
            placeName: {
              zh: "清水寺與二年坂・三年坂",
              en: "Kiyomizu-dera & Ninenzaka Lanes",
            },
            lat: 34.9949,
            lng: 135.785,
            type: "Place",
            note: {
              zh: "由清水舞台遠眺京都盆地，傍晚石板路燈火最迷人。",
              en: "Panoramic views from the wooden stage followed by lantern-lit stone lanes.",
            },
            googleMapsUrl: "https://maps.google.com/?q=34.9949,135.7850",
          },
          {
            time: "19:15",
            placeName: {
              zh: "祇園花見小路京料理",
              en: "Gion Hanamikoji Kyoto Dinner",
            },
            lat: 35.0037,
            lng: 135.7751,
            type: "Food",
            note: {
              zh: "品嚐當季京蔬菜與茶泡飯定食。",
              en: "Seasonal Kyoto obanzai plates in historic Gion.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.0037,135.7751",
          },
        ],
      },
      {
        dayNumber: 2,
        title: {
          zh: "伏見稻荷千本鳥居與宇治茶香",
          en: "Fushimi Inari Torii & Uji Matcha",
        },
        stops: [
          {
            time: "07:45",
            placeName: {
              zh: "伏見稻荷大社千本鳥居",
              en: "Fushimi Inari Taisha Shrine",
            },
            lat: 34.9671,
            lng: 135.7727,
            type: "Place",
            note: {
              zh: "清晨抵達避開旅行團，步行至四辻觀景台折返最輕鬆。",
              en: "Arrive early before tour groups; hike up to the Yotsutsuji viewpoint.",
            },
            googleMapsUrl: "https://maps.google.com/?q=34.9671,135.7727",
          },
          {
            time: "11:30",
            placeName: {
              zh: "宇治平等院與中村藤吉抹茶",
              en: "Uji Byodoin Temple & Matcha Lunch",
            },
            lat: 34.8893,
            lng: 135.8077,
            type: "Food",
            note: {
              zh: "參觀十圓硬幣上的鳳凰堂，再享用生茶凍聖代。",
              en: "Visit the Phoenix Hall featured on the 10-yen coin and enjoy matcha soba.",
            },
            googleMapsUrl: "https://maps.google.com/?q=34.8893,135.8077",
          },
          {
            time: "17:00",
            placeName: {
              zh: "鴨川河畔散步與先斗町",
              en: "Kamogawa River Walk & Pontocho",
            },
            lat: 35.0094,
            lng: 135.7713,
            type: "Place",
            note: {
              zh: "黃昏沿著鴨川跳烏龜石、逛先斗町巷弄居酒屋。",
              en: "Stroll along Kamogawa stepping stones into Pontocho alley.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.0094,135.7713",
          },
        ],
      },
      {
        dayNumber: 3,
        title: {
          zh: "嵐山竹林小徑與大阪道頓堀之夜",
          en: "Arashiyama Bamboo Grove & Osaka Dotonbori",
        },
        stops: [
          {
            time: "08:30",
            placeName: {
              zh: "嵐山竹林小徑與渡月橋",
              en: "Arashiyama Bamboo Grove & Togetsukyo Bridge",
            },
            lat: 35.017,
            lng: 135.6713,
            type: "Place",
            note: {
              zh: "順遊天龍寺曹源池庭園與河畔 Arabica 咖啡。",
              en: "Combine with Tenryu-ji Garden and riverside espresso.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.0170,135.6713",
          },
          {
            time: "12:15",
            placeName: {
              zh: "嵐山湯豆腐料理午餐",
              en: "Arashiyama Yudofu Tofu Lunch",
            },
            lat: 35.0138,
            lng: 135.6777,
            type: "Food",
            note: {
              zh: "清爽細膩的京都名物湯豆腐定食。",
              en: "Delicate Kyoto simmered tofu set overlooking the hills.",
            },
            googleMapsUrl: "https://maps.google.com/?q=35.0138,135.6777",
          },
          {
            time: "16:30",
            placeName: {
              zh: "阪急電鐵移動至大阪難波",
              en: "Hankyu Line Transfer to Osaka Namba",
            },
            lat: 34.6669,
            lng: 135.5003,
            type: "Transport",
            transportType: "Public",
            note: {
              zh: "約 50 分鐘抵達大阪，入住心齋橋周邊旅宿。",
              en: "50-minute train ride into central Osaka; check in near Shinsaibashi.",
            },
            googleMapsUrl: "https://maps.google.com/?q=34.6669,135.5003",
          },
          {
            time: "18:30",
            placeName: {
              zh: "道頓堀與法善寺橫丁晚餐",
              en: "Dotonbori & Hozenji Yokocho Food Crawl",
            },
            lat: 34.6687,
            lng: 135.5013,
            type: "Food",
            note: {
              zh: "大阪燒、現煎章魚燒與串炸一次收齊。",
              en: "Okonomiyaki, freshly griddled takoyaki, and crispy kushikatsu.",
            },
            googleMapsUrl: "https://maps.google.com/?q=34.6687,135.5013",
          },
        ],
      },
      {
        dayNumber: 4,
        title: {
          zh: "黑門市場早市與關西機場返程",
          en: "Kuromon Market & Departure from KIX",
        },
        stops: [
          {
            time: "08:30",
            placeName: {
              zh: "黑門市場海鮮早午餐",
              en: "Kuromon Ichiba Market Brunch",
            },
            lat: 34.6654,
            lng: 135.5065,
            type: "Food",
            note: {
              zh: "現剖海膽、和牛串與季節草莓。",
              en: "Fresh sea urchin, seared beef skewers, and seasonal strawberries.",
            },
            googleMapsUrl: "https://maps.google.com/?q=34.6654,135.5065",
          },
          {
            time: "10:15",
            placeName: {
              zh: "南海電鐵 Rapi:t 前往關西機場",
              en: "Nankai Rapi:t Express to Kansai Airport",
            },
            lat: 34.432,
            lng: 135.2304,
            type: "Transport",
            transportType: "Flight",
            note: {
              zh: "從南海難波站 38 分鐘直達機場第一航廈。",
              en: "38-minute express from Namba Station straight to Terminal 1.",
            },
            googleMapsUrl: "https://maps.google.com/?q=34.4320,135.2304",
          },
        ],
      },
    ],
    expenses: [
      {
        dayOffset: 0,
        amount: 4400,
        currency: Currency.JPY,
        exchangeRate: 0.215,
        category: "Transport",
        note: { zh: "HARUKA 特急與 ICOCA 交通費", en: "HARUKA Express & ICOCA fares" },
      },
      {
        dayOffset: 0,
        amount: 64000,
        currency: Currency.JPY,
        exchangeRate: 0.215,
        category: "Accommodation",
        note: { zh: "京都 2 晚＋大阪 1 晚住宿", en: "Kyoto (2N) + Osaka (1N) hotels" },
      },
      {
        dayOffset: 1,
        amount: 3200,
        currency: Currency.JPY,
        exchangeRate: 0.215,
        category: "Food",
        note: { zh: "宇治抹茶套餐與伴手禮茶葉", en: "Uji matcha set & tea tins" },
      },
      {
        dayOffset: 2,
        amount: 6800,
        currency: Currency.JPY,
        exchangeRate: 0.215,
        category: "Food",
        note: { zh: "嵐山湯豆腐＋道頓堀大阪燒", en: "Arashiyama tofu lunch & Dotonbori dinner" },
      },
    ],
    checklist: [
      {
        text: { zh: "護照與電子登機證備份", en: "Passport & offline boarding pass copy" },
        category: "Documents",
        isCompleted: true,
      },
      {
        text: { zh: "ICOCA 交通卡與日圓零錢袋", en: "ICOCA card & small JPY coin pouch" },
        category: "Documents",
        isCompleted: false,
      },
      {
        text: { zh: "薄外套（京阪日夜溫差大）", en: "Light outer layer for cool Kyoto evenings" },
        category: "Clothing",
        isCompleted: false,
      },
      {
        text: { zh: "行動電源與相機備用電池", en: "Power bank & spare camera battery" },
        category: "Gear",
        isCompleted: false,
      },
      {
        text: { zh: "個人常備藥與休足時間貼片", en: "Personal essentials & foot relief patches" },
        category: "Toiletries",
        isCompleted: false,
      },
    ],
  },
  {
    id: "swiss-5d",
    name: {
      zh: "瑞士阿爾卑斯 5 日鐵道",
      en: "Swiss Alps 5-Day Rail",
    },
    subtitle: {
      zh: "串聯琉森湖、格林德瓦、少女峰、策馬特馬特洪峰與日內瓦湖，一票暢遊世界最美高山鐵道。",
      en: "Scenic Swiss rail journey across Lake Lucerne, Grindelwald, Jungfraujoch, Zermatt's Matterhorn, and Lake Geneva.",
    },
    destination: {
      zh: "瑞士阿爾卑斯",
      en: "Swiss Alps, Switzerland",
    },
    region: {
      zh: "歐洲 · 瑞士",
      en: "Europe · Switzerland",
    },
    days: 5,
    nights: 4,
    currency: Currency.CHF,
    estimatedBudgetTwd: 92000,
    tags: {
      zh: ["景觀鐵道", "阿爾卑斯雪山", "自然療癒"],
      en: ["Scenic Rail", "Alpine Peaks", "Nature"],
    },
    accentTone: "green",
    flight: {
      airline: "SWISS",
      airlineID: "LX",
      airlineNameZh: "瑞士國際航空",
      airlineNameEn: "Swiss International Air Lines",
      outboundFlightNumber: "LX139",
      inboundFlightNumber: "LX138",
      departureAirport: "TPE",
      arrivalAirport: "ZRH",
      outboundDepTime: "23:10",
      outboundArrTime: "06:40",
      inboundDepTime: "13:15",
      inboundArrTime: "07:20",
      terminalOut: "T2",
      terminalIn: "T1",
      cabinClass: "Economy",
      priceTwd: 36500,
    },
    itinerary: [
      {
        dayNumber: 1,
        title: {
          zh: "蘇黎世抵達與琉森湖畔漫步",
          en: "Zurich Arrival & Lake Lucerne Promenade",
        },
        stops: [
          {
            time: "08:15",
            placeName: {
              zh: "SBB 鐵道由蘇黎世機場直達琉森",
              en: "SBB Direct Train from Zurich Airport to Lucerne",
            },
            lat: 47.4582,
            lng: 8.5555,
            type: "Transport",
            transportType: "Public",
            note: {
              zh: "啟用 Swiss Travel Pass，車程約 1 小時。",
              en: "Activate Swiss Travel Pass for the 1-hour scenic ride.",
            },
            googleMapsUrl: "https://maps.google.com/?q=47.4582,8.5555",
          },
          {
            time: "10:30",
            placeName: {
              zh: "琉森卡貝爾木橋與老城區",
              en: "Chapel Bridge & Lucerne Old Town",
            },
            lat: 47.0516,
            lng: 8.3075,
            type: "Place",
            note: {
              zh: "走訪歐洲最古老木橋、水塔與垂死獅子像。",
              en: "Explore Europe's oldest covered timber bridge and the Lion Monument.",
            },
            googleMapsUrl: "https://maps.google.com/?q=47.0516,8.3075",
          },
          {
            time: "18:00",
            placeName: {
              zh: "琉森湖畔瑞式晚餐",
              en: "Lake Lucerne Swiss Bistro Dinner",
            },
            lat: 47.0531,
            lng: 8.3133,
            type: "Food",
            note: {
              zh: "推薦瑞士黃金馬鈴薯煎餅 Rosti 配白酒。",
              en: "Classic golden potato rosti beside the twilight lake.",
            },
            googleMapsUrl: "https://maps.google.com/?q=47.0531,8.3133",
          },
        ],
      },
      {
        dayNumber: 2,
        title: {
          zh: "黃金景觀列車前往格林德瓦",
          en: "GoldenPass Express to Grindelwald",
        },
        stops: [
          {
            time: "09:06",
            placeName: {
              zh: "琉森－因特拉肯黃金景觀快車",
              en: "Luzern-Interlaken Express Scenic Train",
            },
            lat: 46.6863,
            lng: 7.8632,
            type: "Transport",
            transportType: "Public",
            note: {
              zh: "途經龍疆湖與布里恩茨湖，選右側靠窗視野最佳。",
              en: "Sit on the right for emerald views of Lake Lungern and Lake Brienz.",
            },
            googleMapsUrl: "https://maps.google.com/?q=46.6863,7.8632",
          },
          {
            time: "12:15",
            placeName: {
              zh: "格林德瓦夢幻山坡小鎮",
              en: "Grindelwald Alpine Village",
            },
            lat: 46.6242,
            lng: 8.0414,
            type: "Place",
            note: {
              zh: "直面艾格峰北壁，入住木屋陽台景觀房。",
              en: "Check into a chalet overlooking the Eiger North Face.",
            },
            googleMapsUrl: "https://maps.google.com/?q=46.6242,8.0414",
          },
          {
            time: "14:30",
            placeName: {
              zh: "First 山頂懸崖天空步道",
              en: "Grindelwald First Cliff Walk",
            },
            lat: 46.6615,
            lng: 8.0537,
            type: "Place",
            note: {
              zh: "搭纜車登頂健行至巴克普湖高山倒影。",
              en: "Cable car ascent plus easy alpine walk toward Bachalpsee.",
            },
            googleMapsUrl: "https://maps.google.com/?q=46.6615,8.0537",
          },
        ],
      },
      {
        dayNumber: 3,
        title: {
          zh: "歐洲之巔少女峰與瀑布小鎮",
          en: "Jungfraujoch Top of Europe & Lauterbrunnen",
        },
        stops: [
          {
            time: "08:30",
            placeName: {
              zh: "少女峰鞍部 Jungfraujoch 展望台",
              en: "Jungfraujoch - Top of Europe",
            },
            lat: 46.5475,
            lng: 7.9851,
            type: "Place",
            note: {
              zh: "搭乘艾格快線轉齒軌列車登上海拔 3,454 公尺冰川平台。",
              en: "Ride the Eiger Express and cogwheel railway to the 3,454m glacier terrace.",
            },
            googleMapsUrl: "https://maps.google.com/?q=46.5475,7.9851",
          },
          {
            time: "15:00",
            placeName: {
              zh: "勞特布魯嫩瀑布山谷散步",
              en: "Lauterbrunnen Valley & Staubbach Falls",
            },
            lat: 46.5935,
            lng: 7.9091,
            type: "Place",
            note: {
              zh: "欣賞 72 座高山瀑布與童話般的山谷木屋。",
              en: "Stroll beneath soaring cliffside waterfalls in the glacial valley.",
            },
            googleMapsUrl: "https://maps.google.com/?q=46.5935,7.9091",
          },
        ],
      },
      {
        dayNumber: 4,
        title: {
          zh: "策馬特無車山城與馬特洪峰",
          en: "Car-Free Zermatt & Matterhorn Panorama",
        },
        stops: [
          {
            time: "09:30",
            placeName: {
              zh: "高山鐵道前往策馬特無車小鎮",
              en: "Alpine Rail Transfer to Zermatt",
            },
            lat: 46.0207,
            lng: 7.7491,
            type: "Transport",
            transportType: "Public",
            note: {
              zh: "經 Visp 轉乘馬特洪峰哥達鐵路進站。",
              en: "Connect via Visp onto the Matterhorn Gotthard Bahn.",
            },
            googleMapsUrl: "https://maps.google.com/?q=46.0207,7.7491",
          },
          {
            time: "13:30",
            placeName: {
              zh: "葛內拉特登山鐵道 Gornergrat",
              en: "Gornergrat Cogwheel Observatory",
            },
            lat: 45.9834,
            lng: 7.7848,
            type: "Place",
            note: {
              zh: "360 度近距離眺望馬特洪峰與羅莎峰冰河群。",
              en: "Unobstructed 360-degree view of the Matterhorn and Monte Rosa glaciers.",
            },
            googleMapsUrl: "https://maps.google.com/?q=45.9834,7.7848",
          },
          {
            time: "19:00",
            placeName: {
              zh: "策馬特傳統起司鍋晚餐",
              en: "Zermatt Traditional Cheese Fondue",
            },
            lat: 46.0218,
            lng: 7.7478,
            type: "Food",
            note: {
              zh: "經典格呂耶爾起司鍋搭配當地白酒暖身。",
              en: "Warm Gruyere and Vacherin fondue with crisp local white wine.",
            },
            googleMapsUrl: "https://maps.google.com/?q=46.0218,7.7478",
          },
        ],
      },
      {
        dayNumber: 5,
        title: {
          zh: "日內瓦湖大噴泉與蘇黎世返程",
          en: "Lake Geneva & Return via Zurich",
        },
        stops: [
          {
            time: "09:30",
            placeName: {
              zh: "日內瓦湖畔與大噴泉 Jet d'Eau",
              en: "Lake Geneva & Jet d'Eau Promenade",
            },
            lat: 46.2074,
            lng: 6.1559,
            type: "Place",
            note: {
              zh: "沿日內瓦湖漫步並造訪老城區石板廣場。",
              en: "Lakeside walk past Jet d'Eau and Geneva's hilltop Old Town.",
            },
            googleMapsUrl: "https://maps.google.com/?q=46.2074,6.1559",
          },
          {
            time: "11:15",
            placeName: {
              zh: "日內瓦老城精品巧克力與咖啡",
              en: "Geneva Old Town Chocolate & Espresso",
            },
            lat: 46.2011,
            lng: 6.148,
            type: "Food",
            note: {
              zh: "入手瑞士手工松露巧克力作為返程伴手禮。",
              en: "Pick up artisan Swiss pralines before heading to the airport.",
            },
            googleMapsUrl: "https://maps.google.com/?q=46.2011,6.1480",
          },
          {
            time: "12:15",
            placeName: {
              zh: "返程機場報到 (ZRH)",
              en: "Zurich Airport Check-In & Departure",
            },
            lat: 47.4582,
            lng: 8.5555,
            type: "Transport",
            transportType: "Flight",
            note: {
              zh: "於機場退稅櫃檯完成退稅手續後登機。",
              en: "Complete VAT refund formalities before boarding.",
            },
            googleMapsUrl: "https://maps.google.com/?q=47.4582,8.5555",
          },
        ],
      },
    ],
    expenses: [
      {
        dayOffset: 0,
        amount: 295,
        currency: Currency.CHF,
        exchangeRate: 36.2,
        category: "Transport",
        note: { zh: "Swiss Travel Pass 4 日交通通票", en: "Swiss Travel Pass (4-Day)" },
      },
      {
        dayOffset: 1,
        amount: 420,
        currency: Currency.CHF,
        exchangeRate: 36.2,
        category: "Accommodation",
        note: { zh: "格林德瓦＋策馬特木屋旅宿", en: "Grindelwald & Zermatt chalet stays" },
      },
      {
        dayOffset: 2,
        amount: 165,
        currency: Currency.CHF,
        exchangeRate: 36.2,
        category: "Tickets",
        note: { zh: "少女峰來回登山列車票", en: "Jungfraujoch round-trip rail ticket" },
      },
      {
        dayOffset: 3,
        amount: 78,
        currency: Currency.CHF,
        exchangeRate: 36.2,
        category: "Food",
        note: { zh: "策馬特瑞士起司鍋晚餐", en: "Zermatt traditional fondue dinner" },
      },
    ],
    checklist: [
      {
        text: { zh: "Swiss Travel Pass 電子票券 QR 碼", en: "Swiss Travel Pass PDF & QR code" },
        category: "Documents",
        isCompleted: true,
      },
      {
        text: { zh: "護照與申根旅遊醫療保險證明", en: "Passport & Schengen travel insurance" },
        category: "Documents",
        isCompleted: true,
      },
      {
        text: { zh: "洋蔥式防風保暖羽絨外套", en: "Layered windproof alpine jacket" },
        category: "Clothing",
        isCompleted: false,
      },
      {
        text: { zh: "雪地抗 UV 太陽眼鏡與防曬乳", en: "UV sunglasses & high-SPF sunscreen" },
        category: "Toiletries",
        isCompleted: false,
      },
      {
        text: { zh: "瑞士 J 型三孔轉接頭", en: "Switzerland Type-J power adapter" },
        category: "Gear",
        isCompleted: false,
      },
      {
        text: { zh: "防滑登山健行鞋", en: "Waterproof hiking boots" },
        category: "Clothing",
        isCompleted: false,
      },
    ],
  },
];

const formatDateIso = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const addDays = (base: Date, offsetDays: number): Date => {
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + offsetDays);
  return next;
};

let idCounter = 0;
const generateUniqueId = (prefix: string): string => {
  idCounter += 1;
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${idCounter}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
};

/**
 * Generates a full, ready-to-edit Trip object from one of the curated templates,
 * scheduled realistically 30 days from today with unique IDs and full flights,
 * geocoded itinerary stops, sample expenses, and a starter checklist.
 */
export function createTripFromTemplate(
  templateId: string,
  userId?: string,
  userName?: string,
  language: Language = "zh"
): Trip {
  const template =
    CURATED_TRIP_TEMPLATES.find((item) => item.id === templateId) ??
    CURATED_TRIP_TEMPLATES[0];

  const ownerId = userId || "local-traveler";
  const ownerName =
    userName || (language === "en" ? "Traveler" : "旅人");
  const tripId = generateUniqueId("trip");

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = addDays(today, 30);
  const end = addDays(start, template.days - 1);

  const startDate = formatDateIso(start);
  const endDate = formatDateIso(end);

  const flight: FlightInfo = {
    id: generateUniqueId("flight"),
    user_id: ownerId,
    traveler_name: ownerName,
    outbound: {
      airline: template.flight.airline,
      airlineID: template.flight.airlineID,
      airlineNameZh: template.flight.airlineNameZh,
      airlineNameEn: template.flight.airlineNameEn,
      flightNumber: template.flight.outboundFlightNumber,
      departureTime: `${startDate}T${template.flight.outboundDepTime}:00`,
      arrivalTime: `${startDate}T${template.flight.outboundArrTime}:00`,
      departureAirport: template.flight.departureAirport,
      arrivalAirport: template.flight.arrivalAirport,
      terminal: template.flight.terminalOut,
      status: "Scheduled",
    },
    inbound: {
      airline: template.flight.airline,
      airlineID: template.flight.airlineID,
      airlineNameZh: template.flight.airlineNameZh,
      airlineNameEn: template.flight.airlineNameEn,
      flightNumber: template.flight.inboundFlightNumber,
      departureTime: `${endDate}T${template.flight.inboundDepTime}:00`,
      arrivalTime: `${endDate}T${template.flight.inboundArrTime}:00`,
      departureAirport: template.flight.arrivalAirport,
      arrivalAirport: template.flight.departureAirport,
      terminal: template.flight.terminalIn,
      status: "Scheduled",
    },
    price: template.flight.priceTwd,
    currency: Currency.TWD,
    exchangeRate: 1,
    cabinClass: template.flight.cabinClass,
    baggage: {
      carryOn: { count: 1, weight: "7" },
      checked: { count: 1, weight: "23" },
    },
    budget: template.estimatedBudgetTwd,
  };

  const itinerary: DayPlan[] = template.itinerary.map((day, idx) => {
    const dayDate = formatDateIso(addDays(start, idx));
    const items: ItineraryItem[] = day.stops.map((stop) => ({
      id: generateUniqueId("item"),
      trip_id: tripId,
      user_id: ownerId,
      time: stop.time,
      placeName: stop.placeName[language],
      lat: stop.lat,
      lng: stop.lng,
      note: stop.note ? stop.note[language] : undefined,
      googleMapsUrl: stop.googleMapsUrl,
      type: stop.type,
      transportType: stop.transportType,
      date: dayDate,
    }));
    return {
      date: dayDate,
      items,
    };
  });

  const nowIso = new Date().toISOString();
  const expenses: Expense[] = template.expenses.map((seed) => {
    const expDate = formatDateIso(addDays(start, seed.dayOffset));
    return {
      id: generateUniqueId("exp"),
      trip_id: tripId,
      user_id: ownerId,
      user_name: ownerName,
      amount: seed.amount,
      currency: seed.currency,
      category: seed.category,
      date: expDate,
      createdAt: nowIso,
      note: seed.note[language],
      exchangeRate: seed.exchangeRate,
      paidBy: ownerId,
      paidByName: ownerName,
      splitWith: [ownerId],
    };
  });

  const checklist: ChecklistItem[] = template.checklist.map((seed) => ({
    id: generateUniqueId("chk"),
    trip_id: tripId,
    user_id: ownerId,
    text: seed.text[language],
    isCompleted: Boolean(seed.isCompleted),
    category: seed.category,
  }));

  return {
    id: tripId,
    user_id: ownerId,
    name: template.name[language],
    startDate,
    endDate,
    destination: template.destination[language],
    flights: [flight],
    expenses,
    checklist,
    itinerary,
    budget: template.estimatedBudgetTwd,
  };
}
