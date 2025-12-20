import React, { useState } from 'react';
import { X, Calendar, MapPin, Plane, ArrowRight, Loader2, Check, Info, ChevronLeft } from 'lucide-react';
import { fetchTdxFlights } from '../services/tdxService';
import { FlightSegment, Trip, Currency } from '../types';
import { createNewTrip } from '../services/storageService';

interface Props {
  onClose: () => void;
  onSubmit: (tripData: any) => void;
}

type Step = 'outbound-search' | 'outbound-select' | 'inbound-search' | 'inbound-select' | 'review';

// --- Utility Helpers ---
const formatTime = (iso: string) => {
  if (!iso) return "--:--";
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

const getAirlineLogo = (id: string | undefined) => {
  if (!id) return null;
  return `https://pics.avs.io/120/120/${id}.png`;
};

// --- Extracted Sub-components ---

interface SearchStepProps {
  type: 'outbound' | 'inbound';
  origin: string;
  setOrigin: (val: string) => void;
  destination: string;
  setDestination: (val: string) => void;
  flightNumber: string;
  setFlightNumber: (val: string) => void;
  outboundDate: string;
  setOutboundDate: (val: string) => void;
  inboundDate: string;
  setInboundDate: (val: string) => void;
  loading: boolean;
  handleSearch: (type: 'outbound' | 'inbound') => void;
  onBack?: () => void; // New optional back handler
}

const SearchStep: React.FC<SearchStepProps> = ({ 
  type, origin, setOrigin, destination, setDestination, 
  flightNumber, setFlightNumber,
  outboundDate, setOutboundDate, inboundDate, setInboundDate, 
  loading, handleSearch, onBack
}) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
     <div className="text-center mb-6">
       <div className="w-12 h-12 bg-blue-50 text-primary rounded-full flex items-center justify-center mx-auto mb-3">
         <Plane className={type === 'inbound' ? 'rotate-180' : ''} />
       </div>
       <h3 className="text-xl font-bold text-slate-800">
          {type === 'outbound' ? '要去哪裡旅行？' : '什麼時候回來？'}
       </h3>
       <p className="text-slate-500 text-sm">
         {type === 'outbound' ? '透過 TDX 搜尋您的出發航班' : `從 ${destination} 飛回 ${origin}`}
       </p>
     </div>

     <div className="space-y-4">
       {type === 'outbound' && (
         <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">出發地</label>
              <input 
                value={origin} onChange={e => setOrigin(e.target.value.toUpperCase())}
                className="w-full p-3 bg-gray-50 rounded-xl font-mono font-bold text-lg border border-transparent focus:bg-white focus:border-primary/20 focus:outline-none"
                placeholder="TPE"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">目的地</label>
              <input 
                value={destination} onChange={e => setDestination(e.target.value.toUpperCase())}
                className="w-full p-3 bg-gray-50 rounded-xl font-mono font-bold text-lg border border-transparent focus:bg-white focus:border-primary/20 focus:outline-none"
                placeholder="KIX"
              />
            </div>
         </div>
       )}
       
       <div className="grid grid-cols-2 gap-4">
         <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">日期</label>
            <input 
              type="date"
              value={type === 'outbound' ? outboundDate : inboundDate}
              onChange={e => type === 'outbound' ? setOutboundDate(e.target.value) : setInboundDate(e.target.value)}
              className="w-full p-3 bg-gray-50 rounded-xl font-medium border border-transparent focus:bg-white focus:border-primary/20 focus:outline-none"
            />
         </div>
         <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">航班代號 (選填)</label>
            <input 
              value={flightNumber} 
              onChange={e => setFlightNumber(e.target.value.toUpperCase())}
              placeholder="例如 BR198"
              className="w-full p-3 bg-gray-50 rounded-xl font-mono font-bold border border-transparent focus:bg-white focus:border-primary/20 focus:outline-none"
            />
         </div>
       </div>

       <div className="space-y-3">
         <button 
           onClick={() => handleSearch(type)}
           disabled={loading || (type === 'outbound' ? (!origin || !destination || !outboundDate) : !inboundDate)}
           className="w-full bg-slate-900 text-white py-4 rounded-xl font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
         >
           {loading ? <Loader2 className="animate-spin" /> : '搜尋即時航班'}
         </button>

         {onBack && (
           <button 
             onClick={onBack}
             className="w-full text-sm text-slate-500 hover:text-slate-800 font-medium py-2 flex items-center justify-center gap-1"
           >
             <ChevronLeft size={16} /> 返回上一步重新挑選
           </button>
         )}
       </div>
     </div>
  </div>
);

interface SelectStepProps {
  type: 'outbound' | 'inbound';
  origin: string;
  destination: string;
  flightOptions: FlightSegment[];
  handleSelectFlight: (f: FlightSegment) => void;
  setStep: (s: Step) => void;
}

const SelectStep: React.FC<SelectStepProps> = ({ 
  type, origin, destination, flightOptions, handleSelectFlight, setStep 
}) => (
  <div className="space-y-4 h-[450px] flex flex-col animate-in fade-in slide-in-from-right-4 duration-300">
     <div className="flex items-center justify-between mb-2">
       <h3 className="font-bold text-slate-800">選擇{type === 'outbound' ? '去程' : '回程'}航班</h3>
       <span className="text-sm text-slate-500 font-mono">
          {type === 'outbound' ? `${origin} → ${destination}` : `${destination} → ${origin}`}
       </span>
     </div>
     
     <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
       {flightOptions.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
             找不到此日期的航班資訊。
             <button onClick={() => setStep(type === 'outbound' ? 'outbound-search' : 'inbound-search')} className="block mx-auto mt-2 text-primary text-sm underline">修改搜尋</button>
          </div>
       ) : (
         flightOptions.map((f, i) => (
           <div 
             key={i} 
             onClick={() => handleSelectFlight(f)}
             className="bg-white border border-gray-100 p-4 rounded-2xl cursor-pointer hover:border-primary hover:shadow-md transition-all group relative overflow-hidden"
           >
             <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white border border-gray-100 rounded-lg flex items-center justify-center p-1 overflow-hidden shadow-sm">
                    <img 
                      src={getAirlineLogo(f.airlineID)} 
                      alt={f.airline} 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40x40?text=' + f.airlineID;
                      }}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-sm">{f.airlineNameZh || f.airline}</span>
                    <span className="text-[10px] text-slate-400 font-mono uppercase">{f.airlineID}</span>
                  </div>
                </div>
                <span className="text-xs bg-gray-100 text-slate-600 px-2 py-1 rounded font-mono font-bold tracking-tight">{f.flightNumber}</span>
             </div>
             
             <div className="flex items-center justify-between text-sm">
                <div className="flex-1">
                  <div className="font-mono font-bold text-xl text-slate-800 tracking-tight">{formatTime(f.departureTime)}</div>
                  <div className="text-slate-400 text-xs font-bold uppercase">{f.departureAirport}</div>
                  {f.terminal && <div className="text-[10px] text-slate-300">Terminal {f.terminal}</div>}
                </div>
                
                <div className="flex-1 px-4 flex flex-col items-center">
                   <div className="w-full border-t border-dashed border-gray-300 relative">
                      <Plane size={14} className="absolute -top-[7px] left-1/2 -translate-x-1/2 text-primary rotate-90" />
                   </div>
                </div>
                
                <div className="flex-1 text-right">
                  <div className="font-mono font-bold text-xl text-slate-800 tracking-tight">{formatTime(f.arrivalTime)}</div>
                  <div className="text-slate-400 text-xs font-bold uppercase">{f.arrivalAirport}</div>
                </div>
             </div>
             
             {f.status && (
               <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[10px] text-green-600 font-bold uppercase tracking-wider">{f.status}</span>
               </div>
             )}
           </div>
         ))
       )}
     </div>
     <button onClick={() => setStep(type === 'outbound' ? 'outbound-search' : 'inbound-search')} className="text-sm text-slate-400 hover:text-slate-600 flex items-center gap-1">
       <ArrowRight size={14} className="rotate-180" /> 返回搜尋
     </button>
  </div>
);

interface ReviewStepProps {
  outboundFlight: FlightSegment | null;
  inboundFlight: FlightSegment | null;
  destination: string;
  handleCreateTrip: () => void;
  onBack: () => void; // New back handler for review step
}

const ReviewStep: React.FC<ReviewStepProps> = ({ 
  outboundFlight, inboundFlight, destination, handleCreateTrip, onBack 
}) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
     <div className="text-center">
       <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
         <Check size={24} />
       </div>
       <h3 className="text-xl font-bold text-slate-800">確認您的旅程</h3>
       <p className="text-slate-500 text-sm">已成功從 TDX 取得航班班表</p>
     </div>

     <div className="space-y-3">
        <div className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center border border-gray-100">
           <div className="flex items-center gap-3">
              <div className="text-center">
                 <div className="font-mono font-bold text-slate-800 text-lg">{outboundFlight?.departureAirport}</div>
                 <div className="text-[10px] text-slate-400">{formatTime(outboundFlight?.departureTime || '')}</div>
              </div>
              <ArrowRight size={16} className="text-primary" />
              <div className="text-center">
                 <div className="font-mono font-bold text-slate-800 text-lg">{outboundFlight?.arrivalAirport}</div>
                 <div className="text-[10px] text-slate-400">{formatTime(outboundFlight?.arrivalTime || '')}</div>
              </div>
           </div>
           <div className="text-right">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-tighter">去程</div>
              <div className="text-sm font-bold text-slate-700">{outboundFlight?.flightNumber}</div>
              <div className="text-[10px] text-slate-400 font-medium">{outboundFlight?.airlineNameZh || outboundFlight?.airline}</div>
           </div>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-2xl flex justify-between items-center border border-gray-100">
           <div className="flex items-center gap-3">
              <div className="text-center">
                 <div className="font-mono font-bold text-slate-800 text-lg">{inboundFlight?.departureAirport}</div>
                 <div className="text-[10px] text-slate-400">{formatTime(inboundFlight?.departureTime || '')}</div>
              </div>
              <ArrowRight size={16} className="text-primary" />
              <div className="text-center">
                 <div className="font-mono font-bold text-slate-800 text-lg">{inboundFlight?.arrivalAirport}</div>
                 <div className="text-[10px] text-slate-400">{formatTime(inboundFlight?.arrivalTime || '')}</div>
              </div>
           </div>
           <div className="text-right">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-tighter">回程</div>
              <div className="text-sm font-bold text-slate-700">{inboundFlight?.flightNumber}</div>
              <div className="text-[10px] text-slate-400 font-medium">{inboundFlight?.airlineNameZh || inboundFlight?.airline}</div>
           </div>
        </div>
     </div>

     <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex gap-3">
        <Info className="text-blue-500 shrink-0" size={18} />
        <p className="text-xs text-blue-800 leading-relaxed">
           系統將根據目的地機場 <b>{destination}</b> 自動命名。您稍後可以在儀表板中自行更改。
        </p>
     </div>

     <div className="space-y-3">
       <button 
         onClick={handleCreateTrip}
         className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
       >
         建立我的行程 <ArrowRight size={18} />
       </button>
       <button 
         onClick={onBack}
         className="w-full text-sm text-slate-500 hover:text-slate-800 font-medium py-2 flex items-center justify-center gap-1"
       >
         <ChevronLeft size={16} /> 返回修改回程航班
       </button>
     </div>
  </div>
);

export const TripForm: React.FC<Props> = ({ onClose, onSubmit }) => {
  const [step, setStep] = useState<Step>('outbound-search');
  const [loading, setLoading] = useState(false);

  const [origin, setOrigin] = useState('TPE');
  const [destination, setDestination] = useState('');
  const [outboundFlightNumber, setOutboundFlightNumber] = useState('');
  const [inboundFlightNumber, setInboundFlightNumber] = useState('');
  const [outboundDate, setOutboundDate] = useState('');
  const [inboundDate, setInboundDate] = useState('');

  const [flightOptions, setFlightOptions] = useState<FlightSegment[]>([]);
  const [outboundFlight, setOutboundFlight] = useState<FlightSegment | null>(null);
  const [inboundFlight, setInboundFlight] = useState<FlightSegment | null>(null);

  const handleSearch = async (type: 'outbound' | 'inbound') => {
    if (type === 'outbound' && (!origin || !destination || !outboundDate)) return;
    if (type === 'inbound' && (!destination || !origin || !inboundDate)) return;

    setLoading(true);
    setFlightOptions([]);

    try {
      const from = type === 'outbound' ? origin : destination;
      const to = type === 'outbound' ? destination : origin;
      const date = type === 'outbound' ? outboundDate : inboundDate;
      const fNo = type === 'outbound' ? outboundFlightNumber : inboundFlightNumber;

      const results = await fetchTdxFlights(from, to, date, fNo);
      setFlightOptions(results);
      setStep(type === 'outbound' ? 'outbound-select' : 'inbound-select');
    } catch (e) {
      console.error(e);
      alert("抓取航班資料失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFlight = (flight: FlightSegment) => {
    if (step === 'outbound-select') {
      setOutboundFlight(flight);
      if (flight.arrivalTime) {
         const d = new Date(flight.arrivalTime);
         d.setDate(d.getDate() + 4);
         setInboundDate(d.toISOString().split('T')[0]);
      }
      setStep('inbound-search');
    } else {
      setInboundFlight(flight);
      setStep('review');
    }
  };

  const handleCreateTrip = () => {
    if (!outboundFlight || !inboundFlight) return;

    const newTrip = createNewTrip({
      destination: destination,
      startDate: outboundFlight.departureTime.split('T')[0],
      endDate: inboundFlight.departureTime.split('T')[0]
    });

    newTrip.flight = {
      price: 0,
      currency: Currency.TWD,
      cabinClass: 'Economy',
      outbound: outboundFlight,
      inbound: inboundFlight,
      baggage: {
        carryOn: { count: 1, weight: '7kg' },
        checked: { count: 1, weight: '23kg' }
      }
    };

    const airportMap: Record<string, string> = {
      'TPE': '台北', 'TSA': '台北', 'KHH': '高雄',
      'NRT': '東京', 'HND': '東京', 'KIX': '大阪',
      'ICN': '首爾', 'GMP': '首爾', 'BKK': '曼谷',
      'SIN': '新加坡', 'HKG': '香港', 'LHR': '倫敦',
      'JFK': '紐約', 'CDG': '巴黎', 'LAX': '洛杉磯'
    };
    
    if (airportMap[destination]) {
      newTrip.destination = airportMap[destination];
      newTrip.name = `${airportMap[destination]}之旅`;
    } else {
      newTrip.name = `${destination}之旅`;
    }

    onSubmit(newTrip);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">行程小幫手</h2>
            <div className="flex gap-1.5 mt-2">
               <div className={`h-1.5 w-10 rounded-full transition-all duration-300 ${step.includes('outbound') ? 'bg-primary' : 'bg-gray-100'}`} />
               <div className={`h-1.5 w-10 rounded-full transition-all duration-300 ${step.includes('inbound') ? 'bg-primary' : (step === 'review' ? 'bg-primary/40' : 'bg-gray-100')}`} />
               <div className={`h-1.5 w-10 rounded-full transition-all duration-300 ${step === 'review' ? 'bg-primary' : 'bg-gray-100'}`} />
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-gray-100 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
           {step === 'outbound-search' && (
             <SearchStep 
               type="outbound" 
               origin={origin} setOrigin={setOrigin} 
               destination={destination} setDestination={setDestination} 
               flightNumber={outboundFlightNumber} setFlightNumber={setOutboundFlightNumber}
               outboundDate={outboundDate} setOutboundDate={setOutboundDate} 
               inboundDate={inboundDate} setInboundDate={setInboundDate} 
               loading={loading} handleSearch={handleSearch} 
             />
           )}
           {step === 'outbound-select' && (
             <SelectStep 
               type="outbound" 
               origin={origin} destination={destination} 
               flightOptions={flightOptions} 
               handleSelectFlight={handleSelectFlight} 
               setStep={setStep} 
             />
           )}
           {step === 'inbound-search' && (
             <SearchStep 
               type="inbound" 
               origin={origin} setOrigin={setOrigin} 
               destination={destination} setDestination={setDestination} 
               flightNumber={inboundFlightNumber} setFlightNumber={setInboundFlightNumber}
               outboundDate={outboundDate} setOutboundDate={setOutboundDate} 
               inboundDate={inboundDate} setInboundDate={setInboundDate} 
               loading={loading} handleSearch={handleSearch} 
               onBack={() => setStep('outbound-select')}
             />
           )}
           {step === 'inbound-select' && (
             <SelectStep 
               type="inbound" 
               origin={origin} destination={destination} 
               flightOptions={flightOptions} 
               handleSelectFlight={handleSelectFlight} 
               setStep={setStep} 
             />
           )}
           {step === 'review' && (
             <ReviewStep 
               outboundFlight={outboundFlight} 
               inboundFlight={inboundFlight} 
               destination={destination} 
               handleCreateTrip={handleCreateTrip} 
               onBack={() => setStep('inbound-select')}
             />
           )}
        </div>
      </div>
    </div>
  );
};