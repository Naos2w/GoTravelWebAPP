import React, { useState, useEffect } from 'react';
import { Trip, Currency } from './types';
import { getTrips, saveTrip, deleteTrip, createNewTrip } from './services/storageService';
import { Checklist } from './components/Checklist';
import { Itinerary } from './components/Itinerary';
import { Expenses } from './components/Expenses';
import { ImageGenerator } from './components/ImageGenerator';
import { TripForm } from './components/TripForm';
import { FlightManager } from './components/FlightManager';
import { ChatAssistant } from './components/ChatAssistant';
import { 
  Plane, Calendar, CheckSquare, DollarSign, CloudSun, 
  Plus, ArrowRight, Home, Map as MapIcon, ChevronLeft,
  LayoutDashboard, Settings, Key, X, Check, Trash2
} from 'lucide-react';

// --- Sub-components for Layout (Moved outside for stability) ---

const Landing: React.FC<{ onStart: () => void }> = ({ onStart }) => (
  <div className="min-h-screen flex flex-col bg-white">
    <header className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
      <div className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
        Go Travel
      </div>
      <div className="flex items-center gap-4">
        <button onClick={onStart} className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign In</button>
      </div>
    </header>
    <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-5xl md:text-7xl font-bold text-slate-900 tracking-tight mb-6">
        Travel smarter,<br /> not harder.
      </h1>
      <p className="text-xl text-slate-500 max-w-2xl mb-10">
        The all-in-one workspace for your next adventure. Flights, itinerary, expenses, and AI assistance in one beautiful place.
      </p>
      <button 
        onClick={onStart}
        className="group bg-slate-900 text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-slate-800 transition-all flex items-center gap-2"
      >
        Start Planning <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
      </button>
      
      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl">
        {[
          { icon: <MapIcon />, title: "Smart Itinerary", desc: "Drag & drop planning with Google Maps integration." },
          { icon: <CheckSquare />, title: "Pre-trip Lists", desc: "Never forget your passport or charger again." },
          { icon: <DollarSign />, title: "Expense Tracking", desc: "Real-time currency conversion to TWD." }
        ].map((feat, i) => (
          <div key={i} className="p-6 bg-gray-50 rounded-3xl border border-gray-100">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm mb-4 mx-auto">
              {feat.icon}
            </div>
            <h3 className="font-semibold text-lg mb-2">{feat.title}</h3>
            <p className="text-slate-500">{feat.desc}</p>
          </div>
        ))}
      </div>
    </main>
  </div>
);

const TripList: React.FC<{ trips: Trip[], onSelect: (id: string) => void, onCreate: () => void }> = ({ trips, onSelect, onCreate }) => (
  <div className="p-6 max-w-7xl mx-auto">
    <div className="flex justify-between items-center mb-8">
      <div className="flex items-center gap-4">
        <h2 className="text-3xl font-bold text-slate-900">Your Trips</h2>
      </div>
      <button onClick={onCreate} className="bg-primary text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-600 shadow-lg shadow-primary/20 transition-all">
        <Plus size={18} /> New Trip
      </button>
    </div>
    {trips.length === 0 ? (
       <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
         <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
           <Plane size={24} />
         </div>
         <h3 className="text-lg font-semibold text-slate-800 mb-1">No trips yet</h3>
         <p className="text-slate-500 mb-6">Start by adding your flight details.</p>
         <button onClick={onCreate} className="text-primary font-medium hover:underline">Add Flight Ticket</button>
       </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trips.map(trip => (
          <div key={trip.id} onClick={() => onSelect(trip.id)} className="group bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-all">
            <div className="h-48 overflow-hidden relative">
               <img src={trip.coverImage} alt={trip.destination} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6">
                  <h3 className="text-white text-xl font-bold">{trip.name || trip.destination}</h3>
                  <p className="text-white/80 text-sm">
                    {new Date(trip.startDate).toLocaleDateString()} — {new Date(trip.endDate).toLocaleDateString()}
                  </p>
               </div>
            </div>
            <div className="p-4 flex justify-between items-center text-sm text-slate-500">
               <span>{trip.itinerary.length} Days</span>
               <span>NT$ {trip.expenses.reduce((acc, e) => acc + (e.amount * e.exchangeRate), 0).toLocaleString()} spent</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// --- Main App Component ---
const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'list' | 'detail'>('landing');
  const [currentTripId, setCurrentTripId] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'itinerary' | 'checklist' | 'expenses' | 'flights'>('dashboard');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    setTrips(getTrips());
  }, []);

  const handleCreateTripSubmit = (newTrip: Trip) => {
    saveTrip(newTrip);
    setTrips(getTrips());
    setCurrentTripId(newTrip.id);
    setShowCreateForm(false);
    setView('detail');
  };

  const currentTrip = trips.find(t => t.id === currentTripId);

  const updateCurrentTrip = (updatedTrip: Trip) => {
    saveTrip(updatedTrip);
    setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
  };

  const handleDeleteTrip = () => {
    if (!currentTripId) return;
    if (window.confirm("確定要刪除這趟旅程嗎？此動作無法復原。")) {
      deleteTrip(currentTripId);
      setTrips(getTrips());
      setView('list');
      setCurrentTripId(null);
    }
  };

  const renderWeather = () => {
    if (!currentTrip) return null;
    const days = Math.min(5, currentTrip.itinerary.length || 1);
    return (
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <CloudSun className="text-orange-400" /> Weather Forecast
        </h3>
        <div className="flex justify-between items-center overflow-x-auto gap-4 no-scrollbar">
           {Array.from({length: days}).map((_, i) => (
             <div key={i} className="flex flex-col items-center min-w-[60px]">
                <span className="text-xs text-slate-400 mb-1">Day {i+1}</span>
                <CloudSun size={24} className={i % 2 === 0 ? "text-yellow-500" : "text-slate-400"} />
                <span className="text-sm font-semibold mt-1">{25 - i}°</span>
             </div>
           ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-slate-900 pb-20 md:pb-0">
      {view === 'landing' && <Landing onStart={() => setView('list')} />}
      
      {view === 'list' && (
        <>
          <TripList 
            trips={trips} 
            onSelect={(id) => { setCurrentTripId(id); setView('detail'); }} 
            onCreate={() => setShowCreateForm(true)} 
          />
          {showCreateForm && <TripForm onClose={() => setShowCreateForm(false)} onSubmit={handleCreateTripSubmit} />}
        </>
      )}

      {view === 'detail' && currentTrip && (
        <>
          <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
               <div className="flex items-center gap-4">
                 <button onClick={() => setView('list')} className="p-2 hover:bg-gray-100 rounded-lg text-slate-500">
                   <ChevronLeft />
                 </button>
                 <input 
                   value={currentTrip.name || currentTrip.destination} 
                   onChange={(e) => updateCurrentTrip({ ...currentTrip, name: e.target.value })}
                   className="text-lg font-bold bg-transparent focus:outline-none focus:ring-2 ring-primary/20 rounded px-2 w-full md:w-auto"
                 />
               </div>
               
               <div className="hidden md:flex items-center gap-4">
                 <div className="flex gap-1">
                   {[
                     { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
                     { id: 'itinerary', label: 'Itinerary', icon: Calendar },
                     { id: 'checklist', label: 'Checklist', icon: CheckSquare },
                     { id: 'expenses', label: 'Expenses', icon: DollarSign },
                     { id: 'flights', label: 'Tickets', icon: Plane },
                   ].map(tab => (
                     <button
                       key={tab.id}
                       onClick={() => setActiveTab(tab.id as any)}
                       className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all ${
                         activeTab === tab.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-gray-50'
                       }`}
                     >
                       <tab.icon size={16} /> {tab.label}
                     </button>
                   ))}
                 </div>
                 <div className="w-px h-6 bg-gray-200 mx-2"></div>
                 <button 
                   onClick={handleDeleteTrip}
                   className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                   title="刪除旅程"
                 >
                   <Trash2 size={20} />
                 </button>
               </div>
            </div>
          </nav>

          <main className="max-w-7xl mx-auto p-4 md:p-8">
            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                     <h2 className="text-2xl font-bold mb-2">Welcome to {currentTrip.name || currentTrip.destination}!</h2>
                     <p className="text-slate-500">{new Date(currentTrip.startDate).toLocaleDateString()} - {new Date(currentTrip.endDate).toLocaleDateString()}</p>
                     <div className="mt-4 flex gap-3 text-sm">
                        <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium">{currentTrip.flight?.outbound.flightNumber}</span>
                        <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-medium">{currentTrip.flight?.inbound?.flightNumber}</span>
                     </div>
                  </div>
                  <ImageGenerator />
                  {renderWeather()}
                </div>
                <div className="space-y-6">
                   <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                      <h3 className="font-semibold mb-4 text-slate-800">Quick Stats</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between">
                           <span className="text-slate-500">Budget Spent</span>
                           <span className="font-medium">NT$ {currentTrip.expenses.reduce((acc, e) => acc + (e.amount * e.exchangeRate), 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                           <span className="text-slate-500">Checklist</span>
                           <span className="font-medium">{Math.round((currentTrip.checklist.filter(i => i.isCompleted).length / (currentTrip.checklist.length || 1)) * 100)}%</span>
                        </div>
                      </div>
                   </div>
                </div>
              </div>
            )}
            {activeTab === 'itinerary' && <Itinerary trip={currentTrip} onUpdate={updateCurrentTrip} />}
            {activeTab === 'checklist' && <Checklist trip={currentTrip} onUpdate={updateCurrentTrip} />}
            {activeTab === 'expenses' && <Expenses trip={currentTrip} onUpdate={updateCurrentTrip} />}
            {activeTab === 'flights' && <FlightManager trip={currentTrip} onUpdate={updateCurrentTrip} />}
          </main>

          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-2 flex justify-between items-center z-40">
            {[
               { id: 'dashboard', icon: Home },
               { id: 'itinerary', icon: Calendar },
               { id: 'checklist', icon: CheckSquare },
               { id: 'expenses', icon: DollarSign },
               { id: 'flights', icon: Plane },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`p-2 rounded-xl ${activeTab === tab.id ? 'text-primary bg-primary/10' : 'text-slate-400'}`}>
                <tab.icon size={24} />
              </button>
            ))}
            <button onClick={handleDeleteTrip} className="p-2 text-red-400">
              <Trash2 size={24} />
            </button>
          </div>
        </>
      )}

      <ChatAssistant />
    </div>
  );
};

export default App;