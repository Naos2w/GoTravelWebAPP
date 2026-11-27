
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Trip, DayPlan, ItineraryItem, TransportType, User } from '../../types';
import { 
  MapPin, Coffee, Trash2, Map, Plane, Clock, 
  Car, Bike, Footprints, TrainFront, Plus,
  Loader2, Check, X, Lock, ChevronDown, ChevronUp, ChevronLeft, Edit2, List, Navigation,
  Sun, Cloud, CloudRain, Snowflake, CloudLightning, GripVertical
} from 'lucide-react';
import { DateTimeUtils } from '../../shared/services/dateTimeUtils';
import { useTranslation } from "../../shared/contexts/LocalizationContext";
import { supabase } from '../../shared/services/storageService';
import { resolveLocationInput } from './services/mapUrlService';
import { searchFreePlaces } from './services/searchPlaceService';
import { DailyWeatherForecast, fetchDayWeather } from './services/weatherService';
import { reorderAnchorsWithSmartTime, recalculateTransportSegment } from './services/itineraryReorderService';
import { enrichAirportCoords } from '../flights/services/airportCoordsService';

// TODO: [Optimized] Lazy load MapView to code-split Leaflet and map rendering dependencies
const MapView = React.lazy(() => import('./MapView').then(m => ({ default: m.MapView })));

// TODO: [Refactored] Pass currentUser as a prop to avoid duplicate auth fetch
interface Props {
  trip: Trip;
  currentUser: User;
  onUpdate: (trip: Trip, action?: string, payload?: any) => void;
  isGuest?: boolean;
}

const TimePicker: React.FC<{
  value: string;
  onChange: (newTime: string) => void;
  onClose: () => void;
}> = ({ value, onChange, onClose }) => {
  const [hour, minute] = value.split(':');
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    if (ref.current) {
      setTimeout(() => {
        const activeHour = ref.current?.querySelector('.active-hour');
        const activeMinute = ref.current?.querySelector('.active-minute');
        if (activeHour) activeHour.scrollIntoView({ block: 'center', behavior: 'smooth' });
        if (activeMinute) activeMinute.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 50);
    }
  }, []); // Run on mount

  return (
    <div ref={ref} className="absolute top-full right-0 sm:left-0 sm:right-auto mt-2 bg-white/95 dark:bg-[#121318]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.14] rounded-[28px] shadow-2xl z-[210] p-4 flex gap-4 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex flex-col gap-1">
        <div className="text-[8px] font-black text-slate-400 uppercase text-center tracking-widest">H</div>
        <div className="h-40 overflow-y-auto no-scrollbar space-y-1 scroll-smooth">
          {hours.map(h => (
            <button key={h} onClick={() => onChange(`${h}:${minute}`)} className={`w-9 h-9 rounded-lg text-xs font-mono font-black flex items-center justify-center transition-all ${h === hour ? 'bg-primary text-white active-hour' : 'hover:bg-slate-50 dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300'}`}>{h}</button>
          ))}
        </div>
      </div>
      <div className="w-px bg-slate-100 dark:bg-white/[0.1] my-1"></div>
      <div className="flex flex-col gap-1">
        <div className="text-[8px] font-black text-slate-400 uppercase text-center tracking-widest">M</div>
        <div className="h-40 overflow-y-auto no-scrollbar space-y-1 scroll-smooth">
          {minutes.map(m => (
            <button key={m} onClick={() => onChange(`${hour}:${m}`)} className={`w-9 h-9 rounded-lg text-xs font-mono font-black flex items-center justify-center transition-all ${m === minute ? 'bg-primary text-white active-minute' : 'hover:bg-slate-50 dark:hover:bg-white/[0.1] text-slate-600 dark:text-slate-300'}`}>{m}</button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const Itinerary: React.FC<Props> = ({ trip, currentUser, onUpdate, isGuest = false }) => {
  const { t, language } = useTranslation();
  const isEn = language?.startsWith('en');
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [insertingAt, setInsertingAt] = useState<number | null>(null);
  const [showTransportPickerId, setShowTransportPickerId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [nameError, setNameError] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [isMobileCardsCollapsed, setIsMobileCardsCollapsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dragDirection, setDragDirection] = useState<'above' | 'below'>('above');
  const [dayWeather, setDayWeather] = useState<DailyWeatherForecast | null>(null);
  
  // Inline edit state for transport notes
  const [editingTransportId, setEditingTransportId] = useState<string | null>(null);
  const [tempTransportNote, setTempTransportNote] = useState("");

  const scrollAnchorRef = useRef<string | null>(null);
  const editRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const selectionSourceRef = useRef<'map' | 'list' | null>(null);
  const tripRef = useRef<Trip>(trip);
  tripRef.current = trip;

  // Auto-scroll mobile bottom cards when highlighted item changes
  useEffect(() => {
    if (highlightedId && viewMode === 'map' && !isMobileCardsCollapsed) {
      const el = cardRefs.current[highlightedId];
      if (el && typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } catch {
          // Ignore scrollIntoView errors on restricted mobile WebViews
        }
      }
    }
  }, [highlightedId, viewMode, isMobileCardsCollapsed]);

  const TRANSPORT_OPTIONS: { type: TransportType; label: string; icon: any; color: string }[] = [
    { type: 'Public', label: t('transportPublic'), icon: TrainFront, color: 'text-indigo-600 dark:text-indigo-400' },
    { type: 'Car', label: t('transportCar'), icon: Car, color: 'text-slate-600 dark:text-slate-300' },
    { type: 'Bicycle', label: t('transportBike'), icon: Bike, color: 'text-emerald-600 dark:text-emerald-400' },
    { type: 'Walking', label: t('transportWalk'), icon: Footprints, color: 'text-amber-600 dark:text-amber-400' },
    { type: 'Flight', label: t('transportFlight'), icon: Plane, color: 'text-blue-600 dark:text-blue-400' },
  ];

  const days = trip.itinerary || [];
  const currentDay = days[selectedDayIndex];

  // Resolve representative coordinates for the active day (prefer current day's stops, fall back to trip stops)
  const dayWeatherCoords = React.useMemo(() => {
    const findCoords = (items: ItineraryItem[] = []) => {
      for (const raw of items) {
        if (raw.type === 'Transport') continue;
        const stop = enrichAirportCoords(raw);
        if (
          stop.lat != null &&
          stop.lng != null &&
          Number.isFinite(Number(stop.lat)) &&
          Number.isFinite(Number(stop.lng))
        ) {
          return { lat: Number(stop.lat), lng: Number(stop.lng) };
        }
      }
      return null;
    };

    const currentCoords = findCoords(currentDay?.items);
    if (currentCoords) return currentCoords;

    for (const d of days) {
      const fallbackCoords = findCoords(d.items);
      if (fallbackCoords) return fallbackCoords;
    }
    return null;
  }, [currentDay?.items, days]);

  useEffect(() => {
    let cancelled = false;
    setDayWeather(null);

    if (!currentDay?.date || !dayWeatherCoords) {
      return () => {
        cancelled = true;
      };
    }

    fetchDayWeather(dayWeatherCoords.lat, dayWeatherCoords.lng, currentDay.date).then((forecast) => {
      if (!cancelled) {
        setDayWeather(forecast);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [currentDay?.date, dayWeatherCoords]);

  const renderWeatherBadge = () => {
    if (!dayWeather) return null;
    const iconMap = {
      clear: <Sun size={13} className="text-amber-500 shrink-0" />,
      cloudy: <Cloud size={13} className="text-slate-400 shrink-0" />,
      rain: <CloudRain size={13} className="text-sky-500 shrink-0" />,
      snow: <Snowflake size={13} className="text-cyan-400 shrink-0" />,
      thunderstorm: <CloudLightning size={13} className="text-indigo-400 shrink-0" />,
    };
    return (
      <div
        data-testid="day-weather-pill"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 dark:bg-white/[0.07] border border-black/[0.04] dark:border-white/[0.08] text-[11px] font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums shrink-0"
      >
        {iconMap[dayWeather.condition]}
        <span>
          {dayWeather.tempMin}°–{dayWeather.tempMax}°C
        </span>
        {dayWeather.precipProb > 0 && (
          <span className="text-[10px] text-sky-500 dark:text-sky-400">
            {dayWeather.precipProb}%
          </span>
        )}
      </div>
    );
  };

  useEffect(() => {
    if (scrollAnchorRef.current) {
      const element = document.getElementById(`item-${scrollAnchorRef.current}`);
      if (element) {
        if (typeof element.scrollIntoView === 'function') {
          try {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch {
            // Ignore scrollIntoView errors on restricted mobile WebViews / jsdom
          }
        }
        setHighlightedId(scrollAnchorRef.current);
        scrollAnchorRef.current = null;
      }
    }
  }, [trip, selectedDayIndex]);

  // Synchronize map & list viewing interactions (scroll list only when triggered by a map marker click)
  useEffect(() => {
    if (
      highlightedId &&
      viewMode === 'list' &&
      selectionSourceRef.current === 'map' &&
      typeof window !== 'undefined' &&
      window.innerWidth >= 1024
    ) {
      // Small timeout to ensure DOM layout is updated
      const timer = setTimeout(() => {
         const el = document.getElementById(`item-${highlightedId}`);
         if (el && typeof el.scrollIntoView === 'function') {
            try {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch {
              // Ignore scrollIntoView errors on restricted mobile WebViews
            }
         }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [highlightedId, viewMode]);

  // "Smart Grouping": Reorder items to keep Flight sequences (Dep -> Trans -> Arr) visually contiguous.
  // This prevents other users' interleaved items from breaking the visual flow of a flight.
  const displayItems = React.useMemo(() => {
     const items = [...(currentDay?.items || [])];
     
     // We will build a new sorted list
     const ordered: ItineraryItem[] = [];
     const processedIds = new Set<string>();

     for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (processedIds.has(item.id)) continue;

        ordered.push(item);
        processedIds.add(item.id);

        // Check if this is the start of a flight sequence (Place + Flight Type)
        // Usually: Airport (Place) -> Flight (Transport) -> Airport (Place)
        if (item.type === 'Place' && item.transportType === 'Flight') {
            const userId = item.user_id;

            // Look ahead for the *parts* of this flight
            // We expect a Transport part and an Arrival part
            // We scan the rest of the list to find the NEXT Flight Transport and NEXT Flight Place for THIS user
            // CRITICAL: We MUST match user_id to ensure we don't grab someone else's flight parts if they overlap!
            
            // 1. Find Transport
            let transportIdx = -1;
            for (let j = i + 1; j < items.length; j++) {
                const cand = items[j];
                if (!processedIds.has(cand.id) && cand.user_id === userId && cand.type === 'Transport' && cand.transportType === 'Flight') {
                    transportIdx = j;
                    break;
                }
            }

            if (transportIdx !== -1) {
                const transItem = items[transportIdx];
                ordered.push(transItem);
                processedIds.add(transItem.id);

                // 2. Find Arrival (Place)
                // Should be after the transport we just found (chronologically, although list is time-sorted already)
                let arrivalIdx = -1;
                for (let k = transportIdx + 1; k < items.length; k++) {
                    const cand = items[k];
                    if (!processedIds.has(cand.id) && cand.user_id === userId && cand.type === 'Place' && cand.transportType === 'Flight') {
                        arrivalIdx = k;
                        break;
                    }
                }

                if (arrivalIdx !== -1) {
                    const arrItem = items[arrivalIdx];
                    ordered.push(arrItem);
                    processedIds.add(arrItem.id);
                }
            }
        }
     }
     
     return ordered;
  }, [currentDay?.items]);

  const mapItems = React.useMemo(
    () => displayItems.map((item) => enrichAirportCoords(item)),
    [displayItems]
  );

  // Recalculates transport times/durations based on neighbor items
  const recalculateTransport = (prev: ItineraryItem, transport: ItineraryItem, next: ItineraryItem): ItineraryItem => {
     return recalculateTransportSegment(prev, transport, next);
  };

  const maintainListIntegrity = (items: ItineraryItem[]): ItineraryItem[] => {
    // 1. Sort only non-transport items first to establish the backbone
    const anchors = items.filter(i => i.type !== 'Transport').sort((a, b) => a.time.localeCompare(b.time));
    const result: ItineraryItem[] = [];
    
    // 2. Reconstruct list, preserving transports between their specific anchors
    for (let i = 0; i < anchors.length; i++) {
      result.push(anchors[i]);
      
      const nextAnchor = anchors[i+1];
      if (nextAnchor) {
        // Find if there was a transport originally between these two
        // We look in the original 'items' array for a transport that was conceptually 'after' anchors[i]
        const originalIndex = items.findIndex(it => it.id === anchors[i].id);
        const potentialTransport = items[originalIndex + 1];
        
        if (potentialTransport && potentialTransport.type === 'Transport') {
           // Recalculate based on the potentially new times of anchor[i] and nextAnchor
           // BUT only if we haven't manually edited it recently (simple check: transport note is just empty or standard duration format)
           // For now, allow recalculation to keep sync, unless manual override flag exists. 
           // We will proceed with recalculation as default behavior for cleaner UX.
           const updatedTransport = recalculateTransport(anchors[i], potentialTransport, nextAnchor);
           result.push(updatedTransport);
        }
      }
    }
    return result;
  };

  const handleOpenAddForm = (type: 'Place' | 'Food') => {
    if (isGuest || !currentUser) return;
    setIsAddingNew(true);
    let defaultTime = '09:00';
    if (displayItems.length > 0) {
      const lastItem = displayItems[displayItems.length - 1];
      // Try to find the last non-transport item
      const anchors = displayItems.filter(i => i.type !== 'Transport');
      if (anchors.length > 0) {
          const lastAnchor = anchors[anchors.length - 1];
          const [h, m] = lastAnchor.time.split(':').map(Number);
          const nextM = m + 60; // Default 1 hour later
          defaultTime = `${(h + Math.floor(nextM/60)).toString().padStart(2, '0')}:${(nextM%60).toString().padStart(2, '0')}`;
      }
    }
    setEditingItem({
      id: crypto.randomUUID(),
      user_id: currentUser.id,
      time: defaultTime,
      placeName: '',
      type,
      note: '',
      date: currentDay.date
    });
    setIsFormOpen(true);
    setNameError(false);
  };

  const handleEditItem = (item: ItineraryItem) => {
    if (isGuest || item.transportType === 'Flight') return;
    if (item.type !== 'Transport') {
        setIsAddingNew(false);
        setEditingItem({ ...item });
        setIsFormOpen(true);
        setNameError(false);
    }
  };

  // Round minutes up to nearest 5 to align with the TimePicker's 5-minute grid
  const roundTo5 = (mins: number) => Math.ceil(mins / 5) * 5;

  const fetchRouteMins = async (
    lat1: string | number,
    lng1: string | number,
    lat2: string | number,
    lng2: string | number,
    transportType?: TransportType
  ): Promise<number> => {
    let profile = 'driving';
    if (transportType === 'Walking') profile = 'foot';
    else if (transportType === 'Bicycle') profile = 'bicycle';

    try {
      const res = await fetch(`https://routing.openstreetmap.de/${profile === 'foot' ? 'routed-foot' : profile === 'bicycle' ? 'routed-bike' : 'routed-car'}/route/v1/${profile}/${Number(lng1)},${Number(lat1)};${Number(lng2)},${Number(lat2)}?overview=false`);
      const data = await res.json();
      if (data?.routes?.[0] && data.routes[0].duration > 0 && data.routes[0].distance > 0) return roundTo5(Math.max(5, Math.round(data.routes[0].duration / 60)));
    } catch(e) {}
    return 30; // fallback default
  };

  const handleAddSearchResult = async (placeName: string, lat: number, lng: number) => {
    if (isGuest || !currentUser) return;
    
    let defaultTime = '09:00';
    const anchors = displayItems.filter(i => i.type !== 'Transport');
    if (anchors.length > 0) {
        const lastAnchor = anchors[anchors.length - 1];
        let travelMins = 30;
        
        if (lastAnchor.lat != null && lastAnchor.lng != null) {
           travelMins = await fetchRouteMins(lastAnchor.lat, lastAnchor.lng, lat, lng);
        }
        
        const [h, m] = lastAnchor.time.split(':').map(Number);
        let totalMins = roundTo5((h * 60 + m) + travelMins);
        totalMins = totalMins % (24 * 60);

        const nextH = Math.floor(totalMins / 60);
        const nextM = totalMins % 60;
        defaultTime = `${nextH.toString().padStart(2, '0')}:${nextM.toString().padStart(2, '0')}`;
    }

    // Open the form so user can choose Place or Food type before confirming
    setIsAddingNew(true);
    setEditingItem({
      id: crypto.randomUUID(),
      user_id: currentUser.id,
      time: defaultTime,
      placeName,
      lat,
      lng,
      type: 'Place', // default; user can switch to Food
      note: '',
      date: currentDay.date
    });
    setIsFormOpen(true);
    setNameError(false);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItemId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedItemId === id || isGuest) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const midline = rect.top + rect.height / 2;
    setDragDirection(e.clientY < midline ? 'above' : 'below');
    if (dragOverItemId !== id) setDragOverItemId(id);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
       setDragOverItemId(null);
    }
  };

  const applySmartReorder = async (movedId: string, targetId: string, direction: 'above' | 'below') => {
    if (isGuest || !currentDay) return;
    const movedItem = displayItems.find((i) => i.id === movedId);
    if (!movedItem || movedItem.transportType === 'Flight') return;

    const targetDate = currentDay.date;
    const updatedItems = await reorderAnchorsWithSmartTime(
      displayItems,
      movedId,
      targetId,
      direction,
      (from, to, tType) =>
        from.lat != null && from.lng != null && to.lat != null && to.lng != null
          ? fetchRouteMins(from.lat, from.lng, to.lat, to.lng, tType)
          : Promise.resolve(30)
    );

    const latestTrip = tripRef.current;
    const latestDays = [...(latestTrip.itinerary || [])];
    const dayIdx = latestDays.findIndex((d) => d.date === targetDate);
    if (dayIdx === -1) return;

    // Preserve any concurrent Realtime items added to this day while awaiting route times
    const reorderedIds = new Set(updatedItems.map((i) => i.id));
    const concurrentAdditions = latestDays[dayIdx].items.filter(
      (i) => !reorderedIds.has(i.id)
    );
    const mergedItems =
      concurrentAdditions.length > 0
        ? [...updatedItems, ...concurrentAdditions].sort((a, b) =>
            (a.time || "").localeCompare(b.time || "")
          )
        : updatedItems;

    const updatedMoved = mergedItems.find((i) => i.id === movedId) || movedItem;
    latestDays[dayIdx] = { ...latestDays[dayIdx], items: mergedItems };
    scrollAnchorRef.current = movedId;
    onUpdate({ ...latestTrip, itinerary: latestDays }, "UPDATE_ITINERARY_ITEM", updatedMoved);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverItemId(null);
    if (isGuest || !draggedItemId || draggedItemId === targetId) {
      setDraggedItemId(null);
      return;
    }

    const draggedId = draggedItemId;
    setDraggedItemId(null);
    await applySmartReorder(draggedId, targetId, dragDirection);
  };

  const handleMoveStop = async (itemId: string, dir: 'up' | 'down') => {
    if (isGuest) return;
    const anchors = displayItems.filter((i) => i.type !== 'Transport');
    const idx = anchors.findIndex((i) => i.id === itemId);
    if (idx === -1) return;

    const neighbor = dir === 'up' ? anchors[idx - 1] : anchors[idx + 1];
    if (!neighbor || neighbor.transportType === 'Flight') return;

    await applySmartReorder(itemId, neighbor.id, dir === 'up' ? 'above' : 'below');
  };

  const saveTransportNote = (id: string) => {
    const newItems = displayItems.map(it => it.id === id ? { ...it, note: tempTransportNote } : it);
    const newDays = [...days];
    newDays[selectedDayIndex] = { ...currentDay, items: newItems };
    onUpdate({ ...trip, itinerary: newDays });
    setEditingTransportId(null);
  };

  const handleSaveItem = async () => {
    if (!editingItem || !editingItem.placeName.trim()) {
       setNameError(true);
       return;
    }
    
    setIsSaving(true);
    const targetDate = editingItem.date || currentDay.date;
    let finalItem = { ...editingItem, date: targetDate };
    
    // Automatically parse Google Maps URL or raw coordinates if pasted into placeName
    const resolvedUrl = resolveLocationInput(finalItem.placeName);
    if (resolvedUrl) {
      finalItem.placeName = resolvedUrl.placeName;
      finalItem.lat = resolvedUrl.lat;
      finalItem.lng = resolvedUrl.lng;
    }

    if (finalItem.type !== 'Transport') {
        // Find the original item to check if the name has changed
        const originalItem = displayItems.find(i => i.id === finalItem.id);
        const nameChanged = !originalItem || originalItem.placeName !== finalItem.placeName;
        const alreadyHasCoords = finalItem.lat != null && finalItem.lng != null;

        if (nameChanged && !alreadyHasCoords) {
            // First try to find if this place name already exists in the itinerary with coordinates
            const existingItem = displayItems.find(i => 
                i.id !== finalItem.id && 
                i.placeName.toLowerCase() === finalItem.placeName.toLowerCase() && 
                i.lat != null && 
                i.lng != null
            );

            if (existingItem) {
                // Reuse existing coordinates
                finalItem.lat = existingItem.lat;
                finalItem.lng = existingItem.lng;
            } else {
                try {
                    // Try to find an existing anchor item to use as proximity bias
                    const refItem = displayItems.find(i => i.lat != null && i.lng != null && !isNaN(Number(i.lat)));
                    const freeResults = await searchFreePlaces(finalItem.placeName, {
                        language: language === 'en' ? 'en' : 'zh-TW',
                        lat: refItem?.lat ? Number(refItem.lat) : undefined,
                        lng: refItem?.lng ? Number(refItem.lng) : undefined,
                        limit: 1
                    });
                    if (freeResults && freeResults.length > 0) {
                        finalItem.lat = freeResults[0].lat;
                        finalItem.lng = freeResults[0].lng;
                    }
                } catch (e) {
                    console.error('Failed to geocode with searchFreePlaces:', e);
                }
            } // Close else
        } // Close if (nameChanged && !alreadyHasCoords)
        // Precise coords (e.g. from Google Places) are always preserved as-is
    }
    
    // Read the freshest trip after async geocoding so concurrent Realtime updates are preserved
    const latestTrip = tripRef.current;
    const latestDays = [...(latestTrip.itinerary || [])];
    const dayIdx = latestDays.findIndex((d) => d.date === targetDate);
    if (dayIdx === -1) {
      setIsSaving(false);
      return;
    }

    let newItems = [...(latestDays[dayIdx].items || [])];
    const index = newItems.findIndex(i => i.id === finalItem.id);
    
    if (index > -1) {
      // Update existing item
      newItems[index] = finalItem;
      
      // Update surrounding transports immediately
      // Check previous transport
      if (index > 0 && newItems[index-1].type === 'Transport' && index > 1) {
          newItems[index-1] = recalculateTransport(newItems[index-2], newItems[index-1], finalItem);
      }
      // Check next transport
      if (index < newItems.length - 1 && newItems[index+1].type === 'Transport' && index < newItems.length - 2) {
          newItems[index+1] = recalculateTransport(finalItem, newItems[index+1], newItems[index+2]);
      }
    } else {
      newItems.push(finalItem);
    }
    
    // Sort and cleanup
    const updatedItems = maintainListIntegrity(newItems);
    
    latestDays[dayIdx] = { ...latestDays[dayIdx], items: updatedItems };
    
    scrollAnchorRef.current = finalItem.id;
    
    onUpdate({ ...latestTrip, itinerary: latestDays }, "UPDATE_ITINERARY_ITEM", finalItem);
    setIsFormOpen(false);
    setEditingItem(null);
    setIsSaving(false);
  };

  const handleDeleteItem = (itemId: string) => {
    if (isGuest) return;
    const index = displayItems.findIndex(i => i.id === itemId);
    let newItems = [...displayItems];
    
    if (index > -1) {
      const target = newItems[index];
      if (target.transportType === 'Flight') return;

      const idsToDelete = [itemId];

      if (target.type !== 'Transport' && newItems[index+1]?.type === 'Transport' && newItems[index+1]?.transportType !== 'Flight') {
        idsToDelete.push(newItems[index+1].id);
        newItems.splice(index, 2); // Delete Place + Following Transport
      } else {
        newItems.splice(index, 1);
      }

      const updatedItems = maintainListIntegrity(newItems);
      const newDays = [...days];
      newDays[selectedDayIndex] = { ...currentDay, items: updatedItems };
      
      // Update UI Immediately (Optimistic) w/ Action and let App.tsx delete from DB
      onUpdate({ ...trip, itinerary: newDays }, "DELETE_ITINERARY_ITEM", idsToDelete);
    } else {
       // Fallback if index not found (shouldn't happen)
       const updatedItems = maintainListIntegrity(newItems);
       const newDays = [...days];
       newDays[selectedDayIndex] = { ...currentDay, items: updatedItems };
       onUpdate({ ...trip, itinerary: newDays });
    }
  };

  const handleChangeTransportType = async (transportId: string, type: TransportType) => {
    if (isGuest || !currentDay) return;

    const targetDate = currentDay.date;
    // Recalculate duration note with new transport mode profile if neighbors have coordinates
    const idx = displayItems.findIndex(it => it.id === transportId);
    let updatedNote: string | undefined = undefined;

    if (idx > 0 && idx < displayItems.length - 1) {
      const prev = displayItems[idx - 1];
      const next = displayItems[idx + 1];
      if (prev.lat != null && prev.lng != null && next.lat != null && next.lng != null && type !== 'Flight') {
        const mins = await fetchRouteMins(prev.lat, prev.lng, next.lat, next.lng, type);
        updatedNote = `${mins} ${language === 'en' ? 'min' : '分鐘'}`;
      }
    }

    const latestTrip = tripRef.current;
    const latestDays = [...(latestTrip.itinerary || [])];
    const dayIdx = latestDays.findIndex((d) => d.date === targetDate);
    if (dayIdx === -1) return;

    const newItems = latestDays[dayIdx].items.map(it => 
      it.id === transportId ? { ...it, transportType: type, ...(updatedNote !== undefined ? { note: updatedNote } : {}) } : it
    );
    latestDays[dayIdx] = { ...latestDays[dayIdx], items: newItems };
    onUpdate(
      { ...latestTrip, itinerary: latestDays },
      "UPDATE_ITINERARY_ITEM",
      { id: transportId, transportType: type, ...(updatedNote !== undefined ? { note: updatedNote } : {}) }
    );
  };

  const handleInsertTransport = (index: number, type: TransportType) => {
    if (isGuest || !currentUser) return;
    const currentItems = [...displayItems];
    const prev = currentItems[index];
    const next = currentItems[index + 1];
    if (!prev || !next) return;

    // Create temp transport
    const tempTransport: ItineraryItem = {
      id: crypto.randomUUID(),
      user_id: currentUser.id,
      time: '',
      placeName: t('moving'),
      type: 'Transport',
      transportType: type,
      note: '',
      date: currentDay.date
    };
    
    const newTransport = recalculateTransport(prev, tempTransport, next);
    
    const newItems = [...currentItems];
    newItems.splice(index + 1, 0, newTransport);
    setInsertingAt(null);
    
    const newDays = [...days];
    newDays[selectedDayIndex] = { ...currentDay, items: newItems };
    
    scrollAnchorRef.current = newTransport.id;
    onUpdate({ ...trip, itinerary: newDays }, "ADD_ITINERARY_ITEM", newTransport);
  };

  if (days.length === 0) return <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest">{t('noData')}</div>;

  return (
    <div className={`flex flex-col lg:flex-row gap-4 lg:gap-6 ${viewMode === 'list' ? 'h-auto pb-28 lg:h-[calc(100dvh-175px)] lg:pb-0' : 'h-[calc(100dvh-175px)]'} overflow-hidden animate-in fade-in duration-500`}>
      {/* Day Selector — iOS Segmented control on mobile, sleek glass column on desktop */}
      <div className="lg:w-32 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar pb-1 lg:pb-0 shrink-0 px-1">
        {days.map((day, idx) => {
          const isSelected = idx === selectedDayIndex;
          const d = new Date(day.date + 'T00:00:00');
          return (
            <button 
              key={idx} 
              onClick={() => { setSelectedDayIndex(idx); setInsertingAt(null); setHighlightedId(null); selectionSourceRef.current = null; }} 
              className={`flex-shrink-0 lg:w-full p-2.5 lg:p-3 rounded-2xl text-center transition-all duration-300 cursor-pointer active:scale-95 border ${
                isSelected 
                  ? 'bg-primary text-white shadow-md shadow-primary/25 border-primary font-black' 
                  : 'ios27-card text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm'
              }`}
            >
              <div className={`text-[10px] font-black uppercase tracking-wider mb-0.5 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                Day {idx + 1}
              </div>
              <div className="font-bold text-xs sm:text-sm leading-tight font-mono">
                {d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col gap-3 overflow-hidden">

        {/* ── Header bar: Day title + View mode switcher ── */}
        <div className="shrink-0 flex justify-between items-center px-1">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Day {selectedDayIndex + 1}
            </h2>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 font-mono">
              {currentDay.date}
            </span>
            {renderWeatherBadge()}
          </div>
          {!isGuest ? (
            <div className="flex bg-slate-100 dark:bg-white/[0.06] p-1 rounded-2xl border border-black/[0.04] dark:border-white/[0.08] gap-0.5 lg:hidden">
              <button 
                onClick={() => setViewMode('list')} 
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-white/[0.18] text-slate-900 dark:text-white shadow-sm border border-transparent dark:border-white/20' 
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <List size={13}/> {isEn ? 'List' : '列表'}
              </button>
              <button 
                onClick={() => setViewMode('map')} 
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === 'map' 
                    ? 'bg-white dark:bg-white/[0.18] text-slate-900 dark:text-white shadow-sm border border-transparent dark:border-white/20' 
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Map size={13}/> {isEn ? 'Map' : '地圖'}
              </button>
            </div>
          ) : (
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 py-1.5 bg-slate-100 dark:bg-white/10 rounded-xl flex items-center gap-1 lg:hidden">
              <Lock size={11} />{t('readOnly')}
            </div>
          )}
        </div>

        {/* ── Content: map + panel ── */}
        <div className="flex-1 flex gap-3 overflow-hidden">

          {/* Map — always visible in map mode; hidden on mobile in list mode */}
          <div className={`rounded-[28px] sm:rounded-[36px] shadow-sm overflow-hidden border border-black/[0.06] dark:border-white/[0.08] transition-all duration-300 relative
            ${viewMode === 'list' ? 'hidden lg:flex flex-1' : 'flex flex-1'}`}>
            <Suspense fallback={
              <div className="flex-1 flex items-center justify-center bg-slate-100/50 dark:bg-[#0c0d12]">
                <Loader2 className="animate-spin text-primary w-8 h-8" />
              </div>
            }>
              <MapView
                items={mapItems}
                onAddSearchResult={handleAddSearchResult}
                activeItemId={highlightedId}
                onMarkerClick={(id) => { selectionSourceRef.current = 'map'; setHighlightedId(id); }}
                hasBottomCards={viewMode === 'map' && !isMobileCardsCollapsed}
                visibilityTrigger={viewMode}
              />
            </Suspense>

            {/* ── Mobile map mode: Floating Bottom Horizontal Cards Carousel (Apple Maps Style) ── */}
            {viewMode === 'map' && (() => {
              const validItems = mapItems.filter(i =>
                i.lat != null && i.lng != null &&
                Number.isFinite(Number(i.lat)) && Number.isFinite(Number(i.lng)) &&
                i.type !== 'Transport'
              );

              if (validItems.length === 0) return null;

              return (
                <div className="lg:hidden absolute bottom-3 inset-x-0 z-[1000] pointer-events-none flex flex-col gap-1.5 px-3">
                  {/* Apple Maps Grabber Handle & Header Toggle */}
                  <div className="flex justify-end pointer-events-none">
                    <button
                      type="button"
                      onClick={() => setIsMobileCardsCollapsed(!isMobileCardsCollapsed)}
                      className="pointer-events-auto h-8 flex items-center gap-1.5 px-3.5 rounded-full bg-white/95 dark:bg-[#121318]/90 ios27-card backdrop-blur-2xl shadow-lg border border-black/[0.06] dark:border-white/[0.12] text-xs font-bold text-slate-700 dark:text-slate-200 active:scale-95 transition-all cursor-pointer"
                    >
                      <MapPin size={13} className="text-primary" />
                      <span>{validItems.length} {isEn ? 'Stops' : '個景點'}</span>
                      {isMobileCardsCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* Horizontal scroll cards */}
                  {!isMobileCardsCollapsed && (
                    <div className="pointer-events-auto flex gap-2.5 overflow-x-auto no-scrollbar py-1 px-1 snap-x snap-mandatory animate-in fade-in slide-in-from-bottom-3 duration-300">
                      {validItems.map((item, mapIdx) => {
                        const isHighlighted = highlightedId === item.id;
                        const originalIdx = displayItems.findIndex(i => i.id === item.id);
                        const nextOriginal = originalIdx >= 0 ? displayItems[originalIdx + 1] : undefined;
                        const hasTransport = nextOriginal?.type === 'Transport';
                        const transportOpt = hasTransport
                          ? TRANSPORT_OPTIONS.find(o => o.type === nextOriginal.transportType)
                          : null;

                        return (
                          <div
                            key={item.id}
                            ref={el => { cardRefs.current[item.id] = el; }}
                            onClick={() => { selectionSourceRef.current = 'list'; setHighlightedId((prev) => (prev === item.id ? null : item.id)); }}
                            className={`snap-center shrink-0 w-[240px] h-[104px] p-2.5 rounded-2xl border transition-all duration-300 backdrop-blur-xl cursor-pointer select-none active:scale-[0.98] flex flex-col justify-between ${
                              isHighlighted
                                ? 'bg-white/95 dark:bg-[#161822] border-primary ring-2 ring-primary/40 shadow-xl shadow-primary/20 scale-[1.02]'
                                : 'bg-white/85 dark:bg-white/[0.05] border-black/[0.08] dark:border-white/[0.1] shadow-md hover:bg-white dark:hover:bg-white/[0.08]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center justify-between gap-1.5 mb-1">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  isHighlighted ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                                }`}>
                                  STOP {mapIdx + 1}
                                </span>
                                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                                  <Clock size={11} />
                                  <span>{item.time || '--:--'}</span>
                                </div>
                                <a
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${Number(item.lat)},${Number(item.lng)}&travelmode=driving`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  title={isEn ? "Open Google Maps Navigation" : "開啟 Google Maps 導航"}
                                  className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/[0.08] hover:bg-primary hover:text-white flex items-center justify-center text-slate-500 dark:text-slate-300 transition-colors ml-auto"
                                >
                                  <Navigation size={12} />
                                </a>
                              </div>

                              <h4 title={item.placeName} className="text-xs font-black text-slate-900 dark:text-white truncate">
                                {item.placeName}
                              </h4>

                              {item.note && (
                                <p title={item.note} className="text-[10px] text-slate-400 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-amber-500 shrink-0" />
                                  <span className="truncate">{item.note}</span>
                                </p>
                              )}
                            </div>

                            {/* Transport snippet to next stop */}
                            {hasTransport && mapIdx < validItems.length - 1 ? (
                              <div className="pt-1 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-[10px] text-slate-400">
                                <span className="flex items-center gap-1 truncate max-w-[140px]">
                                  {transportOpt && <transportOpt.icon size={11} className={transportOpt.color} />}
                                  <span className="truncate">{transportOpt?.label || t('moving')}</span>
                                </span>
                                {nextOriginal.note && (
                                  <span className="font-mono font-bold text-slate-500 dark:text-slate-400 shrink-0 ml-1">
                                    {nextOriginal.note}
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ── Full list panel (list mode on mobile, always on desktop) ── */}
          <div className={`lg:w-[450px] shrink-0 ios27-card rounded-[24px] sm:rounded-[36px] flex flex-col overflow-hidden
            ${viewMode === 'map' ? 'hidden lg:flex' : 'flex flex-1 lg:flex-none'}`}>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 sm:pb-6 space-y-0 relative custom-scrollbar">

            {displayItems.map((item, idx) => {
              const isTransport = item.type === 'Transport';
              const isFlight = item.transportType === 'Flight'; // Used for locking interactions
              const transportOpt = TRANSPORT_OPTIONS.find(o => o.type === item.transportType);
              const nextItem = currentDay.items[idx + 1];
              
              // Revised Condition: Allow inserting transport if next item is NOT transport. 
              // Removed check for current/next item being Flight type to allow transport after Airport.
              // Also explicitly disable inserting transport after a Flight transport item itself
              const canInsertTransport = nextItem && !isTransport && nextItem.type !== 'Transport' && !isGuest && item.transportType !== 'Flight';
              
              const isHighlighted = highlightedId === item.id;
              const anchorsOnly = displayItems.filter(i => i.type !== 'Transport');
              const anchorPos = anchorsOnly.findIndex(i => i.id === item.id);
              const canMoveUp = !isGuest && !isTransport && !isFlight && anchorPos > 0 && anchorsOnly[anchorPos - 1]?.transportType !== 'Flight';
              const canMoveDown = !isGuest && !isTransport && !isFlight && anchorPos > -1 && anchorPos < anchorsOnly.length - 1 && anchorsOnly[anchorPos + 1]?.transportType !== 'Flight';

              return (
                <React.Fragment key={item.id}>
                  <div 
                    id={`item-${item.id}`} 
                    className={`relative pl-8 sm:pl-12 scroll-mt-20 ${isTransport ? 'pb-2 sm:pb-3' : 'pb-6 sm:pb-8'} 
                                ${draggedItemId === item.id ? 'opacity-40 scale-[0.98] shadow-none z-0' : 'z-10'}
                                transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]
                                ${dragOverItemId === item.id && dragDirection === 'above' ? 'pt-16' : ''}
                                ${dragOverItemId === item.id && dragDirection === 'below' ? 'pb-16' : ''}`}
                    draggable={!isGuest && !isTransport}
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragOver={(e) => handleDragOver(e, item.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, item.id)}
                    onDragEnd={() => { setDraggedItemId(null); setDragOverItemId(null); }}
                  >
                    {/* Glowing Drop Indicator Lines */}
                    {dragOverItemId === item.id && dragDirection === 'above' && (
                        <div className="absolute top-4 left-10 sm:left-14 right-4 h-1 bg-primary rounded-full shadow-[0_0_12px_rgba(59,130,246,0.5)] z-20 pointer-events-none" />
                    )}
                    {dragOverItemId === item.id && dragDirection === 'below' && (
                        <div className="absolute bottom-4 left-10 sm:left-14 right-4 h-1 bg-primary rounded-full shadow-[0_0_12px_rgba(59,130,246,0.5)] z-20 pointer-events-none" />
                    )}
                    {!isTransport && (
                    <div className={`absolute left-[-9px] sm:left-[-12px] top-2.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full border-[3px] bg-white dark:bg-[#121318] z-10 flex items-center justify-center shadow-sm transition-all ${isFlight ? 'border-blue-400' : 'border-slate-200 dark:border-white/[0.15]'}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${isFlight ? 'bg-blue-500' : item.type === 'Place' ? 'bg-primary' : 'bg-orange-500'}`} />
                    </div>
                  )}
                  <div className={`absolute left-[-0.5px] top-8 bottom-0 w-0.5 ${isTransport ? 'border-l-2 border-dashed border-slate-200 dark:border-white/[0.08]' : 'bg-slate-100 dark:bg-white/[0.06]'} last:hidden`} />
                  
                  {isTransport ? (
                    <div className={`group bg-slate-50 dark:bg-white/[0.03] rounded-xl px-3 py-1.5 border border-dashed flex items-center justify-center h-auto min-h-[40px] relative transition-all ${isHighlighted ? 'ring-2 ring-primary bg-primary/10 border-primary shadow-lg' : 'border-slate-200 dark:border-white/[0.08] hover:border-slate-400'}`}>
                       <div className="flex items-center gap-2 relative max-w-full px-12 sm:px-4 justify-center sm:justify-start w-full">
                          <button 
                            disabled={isGuest || isFlight} // Lock flight transport type switching
                            onClick={() => !isGuest && !isFlight && setShowTransportPickerId(item.id)}
                            className={`flex items-center gap-2 p-1 rounded-lg transition-colors shrink-0 ${isGuest || isFlight ? 'cursor-default' : 'hover:bg-slate-100 dark:hover:bg-white/[0.08]'}`}
                          >
                            {transportOpt ? <transportOpt.icon size={13} className={transportOpt.color} /> : null}
                          </button>
                          
                          {/* Read-Only Note Section - Click to open Picker */}
                          <div className="flex-1 min-w-0 flex flex-col items-start overflow-hidden cursor-pointer" onClick={() => !isGuest && !isFlight && setShowTransportPickerId(item.id)}>
                               <span className={`text-[10px] sm:text-xs font-bold whitespace-nowrap text-slate-500 dark:text-slate-400 flex items-center gap-1 w-full hover:text-primary transition-colors`}>
                                  <span className="opacity-60 shrink-0">{t('moving')}: </span>
                                  <span className="truncate w-full">{item.note}</span>
                               </span>
                          </div>
                          
                          {showTransportPickerId === item.id && !isGuest && !isFlight && (
                            <div ref={editRef} className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-white/95 dark:bg-[#161822]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.14] rounded-2xl shadow-xl p-1.5 flex items-center gap-1 animate-in zoom-in-95 duration-200">
                               {TRANSPORT_OPTIONS.filter(o => o.type !== 'Flight').map(opt => (
                                 <button 
                                    key={opt.type} 
                                    onClick={() => { setShowTransportPickerId(null); handleChangeTransportType(item.id, opt.type); }} 
                                    className={`p-2 rounded-xl transition-all shrink-0 ${item.transportType === opt.type ? 'bg-slate-100 dark:bg-white/[0.15]' : 'hover:bg-slate-100 dark:hover:bg-white/[0.08] opacity-60 hover:opacity-100'}`}
                                 >
                                   <opt.icon size={16} className={opt.color} />
                                 </button>
                               ))}
                               <div className="w-px h-6 bg-slate-100 dark:bg-white/[0.1] mx-1" />
                               <button onClick={(e) => { e.stopPropagation(); setShowTransportPickerId(null); }} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-all">
                                 <X size={16} />
                               </button>
                            </div>
                          )}
                       </div>
                       
                       {!isGuest && !isFlight && (
                         <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                            <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 bg-white/80 dark:bg-white/[0.08] text-red-500 hover:text-red-600 rounded-lg shadow-sm border border-slate-100 dark:border-white/[0.1] active:scale-90"><Trash2 size={12}/></button>
                         </div>
                       )}
                    </div>
                  ) : (
                    <div 
                      className={`group p-3 sm:p-3.5 rounded-2xl border transition-all relative shadow-ios ${
                        isHighlighted 
                          ? 'ring-2 ring-primary border-primary bg-primary/10 shadow-2xl scale-[1.02] z-10' 
                          : isFlight 
                            ? 'ring-1 ring-blue-500/30 bg-blue-500/[0.08] border-blue-500/20' 
                            : 'bg-white dark:bg-white/[0.04] border-black/[0.05] dark:border-white/[0.08] hover:border-black/[0.1] dark:hover:border-white/[0.14]'
                      }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-4">
                        <div className="shrink-0 w-12 sm:w-16 flex items-center gap-1">
                          {!isGuest && !isFlight && (
                            <div className="flex flex-col items-center shrink-0">
                              <button
                                type="button"
                                disabled={!canMoveUp}
                                onClick={(e) => { e.stopPropagation(); handleMoveStop(item.id, 'up'); }}
                                aria-label={isEn ? `Move ${item.placeName} up` : `上移 ${item.placeName}`}
                                className="p-0.5 text-slate-400 hover:text-primary disabled:opacity-20 cursor-pointer disabled:cursor-default transition-colors"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <GripVertical size={11} className="hidden sm:block text-slate-300 dark:text-slate-600 cursor-grab active:cursor-grabbing" />
                              <button
                                type="button"
                                disabled={!canMoveDown}
                                onClick={(e) => { e.stopPropagation(); handleMoveStop(item.id, 'down'); }}
                                aria-label={isEn ? `Move ${item.placeName} down` : `下移 ${item.placeName}`}
                                className="p-0.5 text-slate-400 hover:text-primary disabled:opacity-20 cursor-pointer disabled:cursor-default transition-colors"
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>
                          )}
                          <div className={`font-mono font-black text-[10px] sm:text-sm ${isFlight ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                            {item.time}
                          </div>
                        </div>

                        <div 
                           onClick={() => {
                             selectionSourceRef.current = 'list';
                             setHighlightedId((prev) => (prev === item.id ? null : item.id));
                           }}
                           className="flex-1 flex flex-col items-start text-left overflow-x-auto sm:overflow-x-visible custom-thin-scrollbar min-w-0 transition-all cursor-pointer sm:cursor-pointer rounded-xl px-1 hover:bg-slate-50 dark:hover:bg-white/[0.06]"
                        >
                           <div className="flex items-center gap-1.5 w-full justify-start">
                              {isFlight && <Plane size={11} className="text-blue-500 shrink-0" />}
                              <div className={`font-black text-sm sm:text-base whitespace-nowrap sm:whitespace-normal px-1 sm:px-0 ${isFlight ? 'text-blue-900 dark:text-blue-300' : item.type === 'Food' ? 'text-orange-600' : 'text-slate-900 dark:text-white'}`}>
                                 {item.placeName}
                              </div>
                           </div>
                           {item.note && (
                             <div className="text-[10px] sm:text-xs font-medium text-slate-400 whitespace-nowrap sm:whitespace-normal px-1 sm:px-0 w-full text-left mt-0.5">
                               {item.note}
                             </div>
                           )}
                        </div>

                        <div className="shrink-0 flex items-center gap-1 pl-1 sm:pl-3">
                           {isFlight ? (
                              <div className="flex gap-1 justify-end">
                                  <div className="p-1.5 text-slate-300 dark:text-slate-500 flex items-center justify-center">
                                    <Lock size={13} />
                                  </div>
                              </div>
                           ) : (
                             <div className="flex items-center gap-1">
                               <button 
                                 onClick={() => handleEditItem(item)}
                                 disabled={isGuest}
                                 aria-label={`${t('edit')} ${item.placeName}`}
                                 className={`p-1.5 sm:p-2 flex items-center justify-center rounded-xl border border-slate-200/80 dark:border-white/[0.08] transition-all active:scale-95 ${isGuest ? 'opacity-30 cursor-default' : 'bg-slate-50 dark:bg-white/[0.06] text-slate-500 dark:text-slate-300 hover:text-primary cursor-pointer'}`}
                               >
                                 <Edit2 size={13} />
                               </button>
                               <button 
                                 onClick={(e) => { e.stopPropagation(); window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.placeName)}`, '_blank'); }} 
                                 aria-label={isEn ? `Navigate to ${item.placeName}` : `導航前往 ${item.placeName}`}
                                 title={isEn ? "Open Google Maps Navigation" : "開啟 Google Maps 導航"}
                                 className="p-1.5 sm:p-2 flex items-center justify-center bg-slate-50 dark:bg-white/[0.06] text-slate-400 hover:text-primary rounded-xl border border-slate-200/80 dark:border-white/[0.08] active:scale-95 transition-all cursor-pointer"
                               >
                                 <Map size={13} />
                               </button>
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }} 
                                 disabled={isGuest}
                                 aria-label={isEn ? `Delete ${item.placeName}` : `刪除 ${item.placeName}`}
                                 className={`p-1.5 sm:p-2 flex items-center justify-center rounded-xl border border-slate-200/80 dark:border-white/[0.08] transition-all active:scale-95 ${isGuest ? 'opacity-30 cursor-default' : 'bg-slate-50 dark:bg-white/[0.06] text-red-400 hover:text-red-500 cursor-pointer'}`}
                               >
                                 <Trash2 size={13} />
                               </button>
                             </div>
                           )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {canInsertTransport && !isGuest && (
                  <div className="relative flex items-center justify-center py-2 group/btn">
                    <div className="absolute left-[-0.5px] w-0.5 bg-slate-100 dark:bg-white/[0.06] h-full" />
                    {insertingAt === idx ? (
                      <div ref={editRef} className="z-10 bg-white/95 dark:bg-[#161822]/95 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.14] shadow-xl rounded-2xl p-1.5 flex items-center gap-1 animate-in zoom-in-95 duration-200">
                        {TRANSPORT_OPTIONS.filter(o => o.type !== 'Flight').map(opt => (
                          <button key={opt.type} onClick={() => handleInsertTransport(idx, opt.type)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-xl transition-all active:scale-90 shrink-0">
                            <opt.icon size={16} className={opt.color} />
                          </button>
                        ))}
                        <div className="w-px h-6 bg-slate-100 dark:bg-white/[0.1] mx-1" />
                        <button onClick={() => setInsertingAt(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl transition-all">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setInsertingAt(idx)} className="z-10 bg-white dark:bg-[#161822] border border-slate-200 dark:border-white/[0.12] hover:border-primary/40 text-slate-400 dark:text-slate-400 hover:text-primary px-2.5 py-1 rounded-full text-[9px] font-black flex items-center gap-1 transition-all sm:opacity-65 group-hover/btn:opacity-100 shadow-sm hover:shadow-md active:scale-95 cursor-pointer">
                        <Plus size={14} /> <span className="hidden sm:inline font-black ml-1 uppercase">{t('selectTransport')}</span>
                      </button>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
            })}
          </div>    {/* end: flex-1 overflow-y-auto (items list) */}
          </div>    {/* end: full list panel */}

        </div>    {/* end: flex-1 flex gap-3 (inner content row: map + strip + list) */}
      </div>      {/* end: flex-1 flex flex-col gap-3 (main content area) */}


      {isFormOpen && editingItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-[200] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#121318]/95 backdrop-blur-3xl p-6 sm:p-10 rounded-[36px] shadow-2xl w-full max-w-lg border border-black/[0.08] dark:border-white/[0.14] overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -mr-32 -mt-32 pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-6 sm:mb-8">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{isAddingNew ? t('newActivity') : t('editActivity')}</h3>
                <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-white/[0.08] rounded-full text-slate-400 transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6 sm:space-y-8">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('type')}</label>
                  <div className="flex bg-slate-50 dark:bg-white/[0.04] p-1.5 rounded-2xl border border-slate-100 dark:border-white/[0.08]">
                    <button 
                      onClick={() => setEditingItem({ ...editingItem, type: 'Place' })}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${editingItem.type === 'Place' ? 'bg-white dark:bg-white/[0.15] text-primary shadow-sm' : 'text-slate-400'}`}
                    >
                      <MapPin size={13}/> {t('typePlace')}
                    </button>
                    <button 
                      onClick={() => setEditingItem({ ...editingItem, type: 'Food' })}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 ${editingItem.type === 'Food' ? 'bg-white dark:bg-white/[0.15] text-orange-500 shadow-sm' : 'text-slate-400'}`}
                    >
                      <Coffee size={13}/> {t('typeFood')}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
                <div className="sm:col-span-2 space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('placeName')}</label>
                    {!isAddingNew ? (
                      // Read-only when editing existing item — name cannot be changed
                      <div className="w-full bg-slate-100 dark:bg-white/[0.04] p-4 sm:p-5 rounded-2xl sm:rounded-3xl font-bold text-slate-500 dark:text-slate-300 border border-slate-200/50 dark:border-white/[0.06] select-none cursor-default">
                        {editingItem.placeName}
                      </div>
                    ) : (
                      <input
                        autoFocus
                        type="text"
                        value={editingItem.placeName}
                        onChange={e => {
                          const val = e.target.value;
                          const resolved = resolveLocationInput(val);
                          if (resolved) {
                            setEditingItem({
                              ...editingItem,
                              placeName: resolved.placeName,
                              lat: resolved.lat,
                              lng: resolved.lng,
                            });
                          } else {
                            setEditingItem({ ...editingItem, placeName: val });
                          }
                          setNameError(false);
                        }}
                        placeholder="..."
                        className={`w-full bg-slate-50 dark:bg-white/[0.05] p-4 sm:p-5 rounded-2xl sm:rounded-3xl font-bold border-2 outline-none shadow-sm transition-all ${nameError ? 'border-red-500 bg-red-50/10 focus:ring-4 focus:ring-red-500/20 animate-pulse-soft' : 'border-slate-100 dark:border-white/[0.08] focus:ring-2 focus:ring-primary/20 dark:text-white'}`}
                      />
                    )}
                  </div>
                  <div className="space-y-2 relative">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('time')}</label>
                    <button 
                      onClick={() => setShowTimePicker(!showTimePicker)}
                      className="w-full bg-slate-50 dark:bg-white/[0.05] p-4 sm:p-5 rounded-2xl sm:rounded-3xl font-mono font-black text-center flex items-center justify-center gap-2 border border-slate-100 dark:border-white/[0.08] outline-none focus:ring-2 focus:ring-primary/20 dark:text-white shadow-sm"
                    >
                      <Clock size={15} className="text-slate-400" />
                      {editingItem.time}
                    </button>
                    {showTimePicker && (
                      <TimePicker 
                        value={editingItem.time} 
                        onChange={(t) => { setEditingItem({ ...editingItem, time: t }); setShowTimePicker(false); }}
                        onClose={() => setShowTimePicker(false)}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{t('note')}</label>
                  <textarea 
                    value={editingItem.note || ''} 
                    onChange={e => setEditingItem({ ...editingItem, note: e.target.value })}
                    rows={2}
                    placeholder="..."
                    className="w-full bg-slate-50 dark:bg-white/[0.05] p-5 sm:p-6 rounded-[24px] sm:rounded-[32px] font-bold border border-slate-100 dark:border-white/[0.08] outline-none focus:ring-2 focus:ring-primary/20 dark:text-white shadow-sm resize-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                  <button 
                    onClick={handleSaveItem}
                    disabled={isSaving}
                    className="order-1 sm:order-2 flex-1 py-4 sm:py-5 bg-primary text-white rounded-2xl sm:rounded-3xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isSaving && <Loader2 size={16} className="animate-spin" />}
                    {t('save')}
                  </button>
                  <button 
                    onClick={() => setIsFormOpen(false)}
                    className="order-2 sm:order-1 flex-1 py-4 sm:py-5 bg-slate-100 dark:bg-white/[0.08] text-slate-500 dark:text-slate-300 rounded-2xl sm:rounded-3xl font-black hover:bg-slate-200 dark:hover:bg-white/[0.12] transition-all active:scale-95"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};