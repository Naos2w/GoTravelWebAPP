import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ItineraryItem } from '../types';
import L from 'leaflet';
import { useTranslation } from '../contexts/LocalizationContext';

// Remove default marker icon logic since we'll use custom DivIcons
import { MapPin, Car, Search, Loader2, Footprints, TrainFront, Bike, Plane, Route } from 'lucide-react';
import { renderToString } from 'react-dom/server';

interface Props {
  items: ItineraryItem[];
  onAddSearchResult?: (placeName: string, lat: number, lng: number) => void;
  activeItemId?: string | null;
  onMarkerClick?: (id: string) => void;
}

const createCustomIcon = (index: number, type: string) => {
  const isFood = type === 'Food';
  const isFlight = type === 'Flight';
  
  // Choose color based on type
  const bgClass = isFlight ? 'bg-blue-500' : isFood ? 'bg-orange-500' : 'bg-primary';
  const pulseClass = isFlight ? 'bg-blue-500' : isFood ? 'bg-orange-500' : 'bg-primary';
  const shadowClass = isFlight ? 'shadow-blue-500/50' : isFood ? 'shadow-orange-500/50' : 'shadow-primary/50';

  const html = `
    <div class="relative group cursor-pointer">
      <div class="absolute -inset-2 ${pulseClass} rounded-full opacity-20 group-hover:opacity-40 animate-ping-soft transition-opacity"></div>
      <div class="relative w-8 h-8 ${bgClass} rounded-full border-[3px] border-white dark:border-slate-800 shadow-lg ${shadowClass} flex items-center justify-center transform transition-transform group-hover:scale-110 group-hover:-translate-y-1">
        <span class="text-white text-xs font-black">${index + 1}</span>
      </div>
      <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] ${
        isFlight ? 'border-t-blue-500' : isFood ? 'border-t-orange-500' : 'border-t-primary'
      }"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40]
  });
};

const ChangeView = ({ center, bounds, activeItem }: { center?: [number, number], bounds?: L.LatLngBounds, activeItem?: ItineraryItem }) => {
  const map = useMap();
  
  // Create stable primitive dependencies to prevent infinite render loops
  // center is a new array every render, bounds is a new L.LatLngBounds every render
  const centerStr = center ? `${center[0]},${center[1]}` : null;
  const boundsStr = bounds ? bounds.toBBoxString() : null;
  const activeItemId = activeItem?.id;

  useEffect(() => {
    if (activeItem && activeItem.lat != null && activeItem.lng != null) {
      // Must cast to Number because Google Places/Supabase string representations crash Leaflet's flyTo math
      map.flyTo([Number(activeItem.lat), Number(activeItem.lng)], 16, { animate: true, duration: 1.5 });
    } else if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (center) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [centerStr, boundsStr, activeItemId, map]);
  
  return null;
}

const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    // Initial stabilization
    const timer = setTimeout(() => {
       map.invalidateSize();
    }, 250);
    
    // Observer for Split-View changes
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    
    resizeObserver.observe(map.getContainer());
    
    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
    };
  }, [map]);
  return null;
};

const fetchLegRoute = (
  stop1: ItineraryItem,
  stop2: ItineraryItem,
  mode: string
): Promise<{
  geometry: [number, number][];
  duration: number;
  distance: number;
  mode: string;
}> => {
  const lat1 = Number(stop1.lat);
  const lng1 = Number(stop1.lng);
  const lat2 = Number(stop2.lat);
  const lng2 = Number(stop2.lng);

  if (mode === 'flight') {
    return Promise.resolve({
      geometry: [[lat1, lng1], [lat2, lng2]] as [number, number][],
      duration: 0,
      distance: 0,
      mode
    });
  }

  return fetchOSRM(lat1, lng1, lat2, lng2, mode);
};

const fetchOSRM = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  mode: string
): Promise<{
  geometry: [number, number][];
  duration: number;
  distance: number;
  mode: string;
}> => {
  let profile = 'driving';
  if (mode === 'walking') profile = 'foot';
  else if (mode === 'bicycling') profile = 'bicycle';
  
  return fetch(`https://router.project-osrm.org/route/v1/${profile}/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`)
    .then((res) => res.json())
    .then((data) => {
      if (data && data.code === 'Ok' && data.routes?.[0]) {
        const route = data.routes[0];
        const geometry: [number, number][] = route.geometry.coordinates.map((c: any[]) => [c[1], c[0]] as [number, number]);
        return {
          geometry,
          duration: route.duration,
          distance: route.distance,
          mode
        };
      }
      return {
        geometry: [[lat1, lng1], [lat2, lng2]] as [number, number][],
        duration: 0,
        distance: 0,
        mode
      };
    })
    .catch((err) => {
      console.error("OSRM fetch error", err);
      return {
        geometry: [[lat1, lng1], [lat2, lng2]] as [number, number][],
        duration: 0,
        distance: 0,
        mode
      };
    });
};

export const MapView: React.FC<Props> = ({ items, onAddSearchResult, activeItemId, onMarkerClick }) => {
  const { language } = useTranslation();
  const isEn = language?.startsWith('en');

  const [legsRouteInfo, setLegsRouteInfo] = useState<{
    geometry: [number, number][];
    duration: number;
    distance: number;
    mode: string;
  }[]>([]);

  const [routingModeOverride, setRoutingModeOverride] = useState<'auto' | 'driving' | 'walking' | 'bicycling' | 'transit'>('auto');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapRef, setMapRef] = useState<L.Map | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      // 1. Check if user pasted a raw coordinate string (e.g., "35.6585, 139.7454")
      const rawCoordsMatch = searchQuery.match(/^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/);
      if (rawCoordsMatch) {
         setSearchResults([{
            display_name: isEn ? 'Pasted Coordinates (Custom Place)' : '貼上的座標位置 (新增自訂地點)',
            lat: rawCoordsMatch[1],
            lon: rawCoordsMatch[2],
         }]);
         setIsSearching(false);
         return;
      }

      // 2. Check if user pasted a Google Maps Full URL containing @lat,lng or data=!3d...!4d...
      const isGoogleUrl = searchQuery.includes('google.') && searchQuery.includes('/maps/');
      if (isGoogleUrl) {
         // Try to find the exact place pin coordinates in the data parameter (!3d...!4d...)
         const dataCoordsMatch = searchQuery.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
         // Fallback to viewport camera coordinates (@...)
         const googleCoordsMatch = searchQuery.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
         
         const match = dataCoordsMatch || googleCoordsMatch;
         if (match) {
            let name = isEn ? 'Google Maps Custom Place' : 'Google Maps 自訂地點';
            const placeMatch = searchQuery.match(/\/place\/([^\/]+)/);
            if (placeMatch && placeMatch[1]) {
              try { name = decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')); } catch(e) {}
            }
            
            setSearchResults([{
               display_name: name,
               lat: match[1],
               lon: match[2],
            }]);
            setIsSearching(false);
            return;
         }
      }

      // 2.5. Provide existing items as search results if the name matches (Exact or Partial) to save API calls
      const existingMatches = items.filter(i => 
        i.placeName && 
        i.placeName.toLowerCase().includes(searchQuery.toLowerCase()) && 
        i.lat != null && 
        i.lng != null &&
        i.type !== 'Transport'
      );

      if (existingMatches.length > 0) {
        const uniqueMatches: any[] = [];
        const seen = new Set();
        for (const match of existingMatches) {
          if (!seen.has(match.placeName)) {
            seen.add(match.placeName);
            uniqueMatches.push({
               display_name: match.placeName,
               address: isEn ? 'From your itinerary' : '來自你的行程',
               lat: match.lat,
               lon: match.lng
            });
          }
        }
        
        const exactMatch = uniqueMatches.find(m => m.display_name.toLowerCase() === searchQuery.toLowerCase());
        if (exactMatch) {
            setSearchResults([exactMatch]);
            setIsSearching(false);
            return;
        }
      }

      // 3. Semantic Search (Google Places API if available, else OpenStreetMap Nominatim)
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

      if (apiKey) {
        let locationBias = {};
        if (mapRef) {
          try {
            const bounds = mapRef.getBounds();
            locationBias = {
              locationBias: {
                rectangle: {
                  low: { latitude: bounds.getSouthWest().lat, longitude: bounds.getSouthWest().lng },
                  high: { latitude: bounds.getNorthEast().lat, longitude: bounds.getNorthEast().lng }
                }
              }
            };
          } catch(e) {}
        }
        
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.displayName,places.location,places.formattedAddress'
          },
          body: JSON.stringify({
            textQuery: searchQuery,
            languageCode: language === 'en' ? 'en' : 'zh-TW',
            ...locationBias
          })
        });
        
        const data = await response.json();
        
        if (data.places) {
           setSearchResults(data.places.map((p: any) => ({
              display_name: p.displayName?.text || '',
              address: p.formattedAddress || '',
              lat: p.location.latitude,
              lon: p.location.longitude
           })));
        } else {
           setSearchResults([]);
        }
      } else {
        // Fallback to OpenStreetMap semantic search (Nominatim)
        let viewboxParam = '';
        if (mapRef) {
          try {
            const bounds = mapRef.getBounds();
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            // Nominatim format: <left>,<top>,<right>,<bottom>
            viewboxParam = `&viewbox=${sw.lng},${ne.lat},${ne.lng},${sw.lat}`;
          } catch(e) {}
        }

        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5${viewboxParam}`, { 
          headers: { 
            'User-Agent': 'GoTravelApp/1.0',
            'Accept-Language': language === 'en' ? 'en' : 'zh-TW'
          } 
        });
        const data = await res.json();
        
        // Add a helpful hint if OSM search fails but they might be trying to use Google Maps
        if (data.length === 0 && searchQuery.includes('maps.app.goo.gl')) {
           setSearchResults([{
              display_name: isEn ? 'Please use full Google Maps URL' : '請使用完整 Google Maps 網址',
              lat: '0', lon: '0',
              isErrorHint: true,
              hint: isEn ? 'Short URLs cannot be resolved directly. Please open it in a desktop browser and paste the full URL (containing @ coordinates).' : '短網址無法直接解析。請在電腦版瀏覽器打開連結後，複製上方的「完整網址」(含有 @座標)，直接貼上來即可！'
           }]);
        } else {
           setSearchResults(data);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setIsSearching(false);
  };


  const handleAddResult = (result: any) => {
    if (result.isErrorHint) return; // Prevent adding if it's just an error hint message

    if(onAddSearchResult) {
      onAddSearchResult(result.display_name.split(',')[0], parseFloat(result.lat), parseFloat(result.lon));
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  // Filter out any items where lat or lng is missing, null, or undefined
  const validItems = items.filter(i => 
    i.lat != null && 
    i.lng != null && 
    !isNaN(i.lat) && 
    !isNaN(i.lng) && 
    i.type !== 'Transport'
  );
  const pathPositions: [number, number][] = validItems.map(i => [Number(i.lat), Number(i.lng)]);
  
  let center: [number, number] = [23.5, 121]; // default center
  let bounds: L.LatLngBounds | undefined = undefined;

  if (validItems.length > 0) {
    center = [Number(validItems[0].lat!), Number(validItems[0].lng!)];
    bounds = L.latLngBounds(pathPositions);
  }

  const getLegMode = (stop1: ItineraryItem, stop2: ItineraryItem) => {
    if (routingModeOverride !== 'auto') {
      return routingModeOverride;
    }
    
    const idx1 = items.findIndex(it => it.id === stop1.id);
    const idx2 = items.findIndex(it => it.id === stop2.id);
    if (idx1 === -1 || idx2 === -1) return 'driving';
    
    const start = Math.min(idx1, idx2);
    const end = Math.max(idx1, idx2);
    for (let i = start + 1; i < end; i++) {
      if (items[i].type === 'Transport') {
        const mode = items[i].transportType;
        if (mode === 'Walking') return 'walking';
        if (mode === 'Public') return 'transit';
        if (mode === 'Car') return 'driving';
        if (mode === 'Bicycle') return 'bicycling';
        if (mode === 'Flight') return 'flight';
      }
    }
    return 'driving';
  };

  // Fetch routing data leg-by-leg whenever validItems or routingModeOverride changes
  useEffect(() => {
    if (validItems.length < 2) {
      setLegsRouteInfo([]);
      return;
    }
    
    const fetchAllLegs = async () => {
      const legPromises = [];
      for (let idx = 0; idx < validItems.length - 1; idx++) {
        const stop1 = validItems[idx];
        const stop2 = validItems[idx + 1];
        const mode = getLegMode(stop1, stop2);
        legPromises.push(fetchLegRoute(stop1, stop2, mode));
      }
      
      try {
        const results = await Promise.all(legPromises);
        setLegsRouteInfo(results);
      } catch (err) {
        console.error("Error fetching all legs route info", err);
      }
    };

    fetchAllLegs();
  }, [JSON.stringify(pathPositions), routingModeOverride]);

  const activeItem = validItems.find(i => i.id === activeItemId);

  return (
    <div className="w-full h-full rounded-2xl sm:rounded-[32px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800 relative z-0 bg-slate-50 dark:bg-slate-900 group">
      
      {/* Search Overlay */}
      <div className="absolute top-4 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[340px] z-[1000] flex flex-col gap-2 pointer-events-none transition-all duration-300">
         <form onSubmit={handleSearch} className="flex gap-2 pointer-events-auto relative">
            <input 
              type="text" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isEn ? "Search places to add..." : "搜尋地點以快速加入..."} 
              className="flex-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg rounded-2xl pl-10 pr-4 py-3 sm:py-3.5 text-xs sm:text-sm font-bold border transform transition-all focus:scale-[1.02] border-slate-100 dark:border-slate-700 outline-none focus:ring-4 focus:ring-primary/20 dark:text-white"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </div>
         </form>
         {searchResults.length > 0 && (
           <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-2xl shadow-black/10 rounded-2xl p-2 overflow-hidden pointer-events-auto max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1 border border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
             <div className="flex justify-between items-center px-3 pt-1 pb-2 border-b border-slate-100 dark:border-slate-800 mb-1">
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isEn ? 'Search Results' : '搜尋結果'}</span>
               <button onClick={() => setSearchResults([])} className="text-slate-400 hover:text-slate-600 text-[10px] uppercase font-bold">{isEn ? 'Close' : '關閉'}</button>
             </div>
             {searchResults.map((r, i) => (
               <button key={i} onClick={() => handleAddResult(r)} className="text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all flex flex-col active:scale-95">
                 <span className="font-black text-sm text-slate-800 dark:text-slate-100 line-clamp-1">{r.display_name.split(',')[0]}</span>
                 {r.isErrorHint ? (
                   <span className="text-[10px] font-medium text-orange-500 whitespace-normal mt-0.5 leading-tight">{r.hint}</span>
                 ) : r.address ? (
                   <span className="text-[10px] font-medium text-slate-400 line-clamp-1 mt-0.5">{r.address}</span>
                 ) : (
                   <span className="text-[10px] font-medium text-slate-400 line-clamp-1 mt-0.5">{r.display_name}</span>
                 )}
               </button>
             ))}
           </div>
         )}
      </div>

      {/* Decorative Overlay Gradient */}
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.05)] z-10" />

      {validItems.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/50 dark:bg-slate-900/50 z-20">
          <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full shadow-lg flex items-center justify-center border border-slate-100 dark:border-slate-700 mb-4 animate-bounce-soft">
            <MapPin size={24} className="text-slate-400" />
          </div>
          <p className="text-xs text-slate-400 mt-2 max-w-[200px] text-center">
            {isEn ? 'Add places with valid coordinates to see them mapped here.' : '新增帶有坐標的地點即可在地圖上查看。'}
          </p>
        </div>
      ) : (
      <>
        {/* Travel Mode Selector Overlay */}
        <div className="absolute bottom-4 left-4 z-[1000] pointer-events-auto flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md shadow-lg rounded-2xl p-1 border border-slate-100 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setRoutingModeOverride('auto')}
            title={isEn ? "Auto (by Itinerary)" : "自動 (依行程)"}
            className={`p-2 rounded-xl transition-all flex items-center justify-center ${routingModeOverride === 'auto' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
          >
            <Route size={15} />
          </button>
          <div className="w-px h-5 bg-slate-100 dark:bg-slate-700" />
          <button
            type="button"
            onClick={() => setRoutingModeOverride('driving')}
            title={isEn ? "Always Driving" : "全域開車"}
            className={`p-2 rounded-xl transition-all flex items-center justify-center ${routingModeOverride === 'driving' ? 'bg-slate-600 dark:bg-slate-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
          >
            <Car size={15} />
          </button>
          <button
            type="button"
            onClick={() => setRoutingModeOverride('walking')}
            title={isEn ? "Always Walking" : "全域走路"}
            className={`p-2 rounded-xl transition-all flex items-center justify-center ${routingModeOverride === 'walking' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
          >
            <Footprints size={15} />
          </button>
          <button
            type="button"
            onClick={() => setRoutingModeOverride('transit')}
            title={isEn ? "Always Transit" : "全域大眾運輸"}
            className={`p-2 rounded-xl transition-all flex items-center justify-center ${routingModeOverride === 'transit' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
          >
            <TrainFront size={15} />
          </button>
          <button
            type="button"
            onClick={() => setRoutingModeOverride('bicycling')}
            title={isEn ? "Always Cycling" : "全域自行車"}
            className={`p-2 rounded-xl transition-all flex items-center justify-center ${routingModeOverride === 'bicycling' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
          >
            <Bike size={15} />
          </button>
        </div>

        <MapContainer ref={setMapRef} center={center} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }} zoomControl={false}>
        {/* Using a Premium, Clean Basemap (CartoDB Positron) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          className="dark:invert dark:contrast-100 dark:hue-rotate-180 dark:brightness-90 transition-all duration-300"
        />
        <MapResizer />
        {validItems.length > 0 && <ChangeView bounds={bounds} activeItem={activeItem} />}
        
        {/* Draw the connected route legs */}
        {legsRouteInfo && legsRouteInfo.length > 0 ? (
          legsRouteInfo.map((leg, idx) => {
            let color = '#64748B'; // Slate (Driving / default)
            let dashArray = undefined;
            let weight = 4;
            let opacity = 0.8;

            if (leg.mode === 'walking') {
              color = '#F59E0B'; // Amber
              dashArray = '5, 8'; // Dotted/dashed
              weight = 4;
            } else if (leg.mode === 'transit') {
              color = '#6366F1'; // Indigo
              dashArray = '10, 10';
              weight = 4;
            } else if (leg.mode === 'bicycling') {
              color = '#10B981'; // Emerald
              weight = 4;
            } else if (leg.mode === 'flight') {
              color = '#3B82F6'; // Blue
              dashArray = '5, 10';
              weight = 3;
              opacity = 0.6;
            }

            return (
              <Polyline
                key={`leg-route-${idx}`}
                positions={leg.geometry}
                color={color}
                weight={weight}
                opacity={opacity}
                dashArray={dashArray}
              />
            );
          })
        ) : pathPositions.length > 1 ? (
          <Polyline 
            positions={pathPositions} 
            color="#64748B" 
            weight={3} 
            opacity={0.8} 
            dashArray="10, 10" 
          />
        ) : null}

        {/* Draw Driving Times between stops if we have routing data */}
        {legsRouteInfo && legsRouteInfo.length > 0 && validItems.length > 1 && validItems.map((item, idx) => {
           if (idx === validItems.length - 1) return null;
           const nextItem = validItems[idx + 1];
           const leg = legsRouteInfo[idx];
           if (!leg || !leg.geometry || leg.geometry.length < 2) return null;
           
           // Calculate midpoint of the route geometry instead of straight line midpoint for better accuracy!
           const midPointIdx = Math.floor(leg.geometry.length / 2);
           const [midLat, midLng] = leg.geometry[midPointIdx];
           
           const mins = Math.max(1, Math.round(leg.duration / 60)); // Minimum 1 min
           if (mins === 0 && leg.mode !== 'flight') return null; // hide if 0 duration except for flight
           
           let modeIcon = '';
           let modeText = isEn ? 'Drive' : '車程';
           let bgClass = 'bg-slate-500 border-slate-400/30 text-white';
           
           if (leg.mode === 'walking') {
             modeIcon = renderToString(<Footprints size={11} strokeWidth={2.5} />);
             modeText = isEn ? 'Walk' : '步行';
             bgClass = 'bg-amber-500 border-amber-400/30 text-white';
           } else if (leg.mode === 'transit') {
             modeIcon = renderToString(<TrainFront size={11} strokeWidth={2.5} />);
             modeText = isEn ? 'Transit' : '乘車';
             bgClass = 'bg-indigo-500 border-indigo-400/30 text-white';
           } else if (leg.mode === 'bicycling') {
             modeIcon = renderToString(<Bike size={11} strokeWidth={2.5} />);
             modeText = isEn ? 'Bike' : '騎車';
             bgClass = 'bg-emerald-500 border-emerald-400/30 text-white';
           } else if (leg.mode === 'flight') {
             modeIcon = renderToString(<Plane size={11} strokeWidth={2.5} />);
             modeText = isEn ? 'Flight' : '飛行';
             bgClass = 'bg-blue-500 border-blue-400/30 text-white';
           } else {
             modeIcon = renderToString(<Car size={11} strokeWidth={2.5} />);
           }
           
           const displayStr = leg.mode === 'flight' 
             ? modeText
             : `${modeText} ${mins} ${isEn ? 'min' : '分鐘'}`;
           
           return (
             <Marker 
               key={`duration-${idx}`} 
               position={[midLat, midLng]}
               zIndexOffset={100}
               icon={L.divIcon({
                 html: `<div class="${bgClass} backdrop-blur-md px-2 py-1 rounded-xl shadow-lg border text-[9px] sm:text-[10px] font-black whitespace-nowrap flex items-center justify-center gap-1.5 transform hover:scale-110 transition-transform cursor-default z-[999] group/time">
                          <div class="text-white/80 group-hover/time:text-white transition-colors">
                            ${modeIcon}
                          </div>
                          ${displayStr}
                        </div>`,
                 className: 'custom-leaflet-marker z-[999]',
                 iconSize: [85, 24],
                 iconAnchor: [42, 12]
               })}
             />
           );
        })}

        {/* Draw the markers last so they sit on top of the line */}
        {validItems.map((item, idx) => (
          <Marker 
            key={item.id} 
            position={[Number(item.lat!), Number(item.lng!)]}
            icon={createCustomIcon(idx, item.type)}
            eventHandlers={{
              click: () => onMarkerClick && onMarkerClick(item.id)
            }}
          >
            <Popup className="custom-popup" closeButton={false}>
              <div className="p-1 px-2 min-w-[120px]">
                <div className="flex items-center gap-2 mb-1.5 border-b border-slate-100 dark:border-slate-700/50 pb-1.5">
                  <div className={`px-1.5 py-0.5 rounded text-[10px] font-black ${item.transportType === 'Flight' ? 'bg-blue-100 text-blue-600' : item.type === 'Food' ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-primary'}`}>
                    {item.time}
                  </div>
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-auto">
                    STOP {idx + 1}
                  </div>
                </div>
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100 leading-tight">
                  {item.placeName}
                </div>
                {item.note && (
                  <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                    {item.note}
                  </div>
                )}
                {/* Google Maps navigation button — mobile only */}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${Number(item.lat)},${Number(item.lng)}&travelmode=driving`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="gmap-nav-btn"
                >
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
                  </svg>
                  {isEn ? 'Navigate' : '導航'}
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      </>
      )}
    </div>
  );
};
