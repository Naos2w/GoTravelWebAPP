import React, { useEffect, useState, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ItineraryItem } from '../types';
import L from 'leaflet';
import { useTranslation } from '../contexts/LocalizationContext';
import { resolveLocationInput } from '../services/mapUrlService';
import { searchFreePlaces } from '../services/searchPlaceService';

// Remove default marker icon logic since we'll use custom DivIcons
import { MapPin, Car, Search, Loader2, Footprints, TrainFront, Bike, Plane, Route } from 'lucide-react';
import { renderToString } from 'react-dom/server';

interface Props {
  items: ItineraryItem[];
  onAddSearchResult?: (placeName: string, lat: number, lng: number) => void;
  activeItemId?: string | null;
  onMarkerClick?: (id: string) => void;
  hasBottomCards?: boolean;
}

const MARKER_ICON_CACHE = new Map<string, L.DivIcon>();
const DURATION_ICON_CACHE = new Map<string, L.DivIcon>();

const MODE_ICON_HTML: Record<string, string> = {
  walking: renderToString(<Footprints size={11} strokeWidth={2.5} />),
  transit: renderToString(<TrainFront size={11} strokeWidth={2.5} />),
  bicycling: renderToString(<Bike size={11} strokeWidth={2.5} />),
  flight: renderToString(<Plane size={11} strokeWidth={2.5} />),
  driving: renderToString(<Car size={11} strokeWidth={2.5} />),
};

const getDurationDivIcon = (
  iconColorClass: string,
  modeIcon: string,
  displayStr: string
): L.DivIcon => {
  const key = `${iconColorClass}:${displayStr}`;
  const cached = DURATION_ICON_CACHE.get(key);
  if (cached) return cached;

  const icon = L.divIcon({
    html: `<div class="bg-slate-900/90 dark:bg-[#121318]/95 border border-white/15 text-white backdrop-blur-md px-2.5 py-1 rounded-full shadow-lg text-[9px] sm:text-[10px] font-bold font-mono tabular-nums whitespace-nowrap flex items-center justify-center gap-1.5 transform hover:scale-110 transition-transform cursor-default z-[999] group/time">
                          <div class="${iconColorClass} transition-colors">
                            ${modeIcon}
                          </div>
                          ${displayStr}
                        </div>`,
    className: 'custom-leaflet-marker z-[999]',
    iconSize: [108, 26],
    iconAnchor: [54, 13],
  });
  DURATION_ICON_CACHE.set(key, icon);
  return icon;
};

const createCustomIcon = (index: number, type: string, isActive = false) => {
  const cacheKey = `${index}:${type}:${isActive ? '1' : '0'}`;
  const cached = MARKER_ICON_CACHE.get(cacheKey);
  if (cached) return cached;

  const isFood = type === 'Food';
  const isFlight = type === 'Flight';
  
  // Choose color based on type
  const bgClass = isFlight ? 'bg-blue-500' : isFood ? 'bg-orange-500' : 'bg-primary';
  const pulseClass = isFlight ? 'bg-blue-500' : isFood ? 'bg-orange-500' : 'bg-primary';
  const shadowClass = isFlight ? 'shadow-blue-500/50' : isFood ? 'shadow-orange-500/50' : 'shadow-primary/50';
  const sizeClass = isActive
    ? 'w-8 h-8 ring-4 ring-white/30 dark:ring-primary/40 scale-110 -translate-y-1'
    : 'w-7 h-7';

  const html = `
    <div class="relative group cursor-pointer">
      ${isActive ? `<div class="absolute -inset-2 ${pulseClass} rounded-full opacity-35 animate-pulse-soft"></div>` : ''}
      <div class="relative ${sizeClass} ${bgClass} rounded-full border-[2.5px] border-white dark:border-slate-900 shadow-lg ${shadowClass} flex items-center justify-center transform transition-transform group-hover:scale-110 group-hover:-translate-y-1">
        <span class="text-white ${isActive ? 'text-xs' : 'text-[11px]'} font-black font-mono tabular-nums">${index + 1}</span>
      </div>
      <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[7px] ${
        isFlight ? 'border-t-blue-500' : isFood ? 'border-t-orange-500' : 'border-t-primary'
      }"></div>
    </div>
  `;

  const icon = L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: isActive ? [32, 40] : [28, 36],
    iconAnchor: isActive ? [16, 40] : [14, 36],
    popupAnchor: isActive ? [0, -40] : [0, -36]
  });
  MARKER_ICON_CACHE.set(cacheKey, icon);
  return icon;
};

const ChangeView = ({ center, bounds, activeItem }: { center?: [number, number], bounds?: L.LatLngBounds, activeItem?: ItineraryItem }) => {
  const map = useMap();
  const prevActiveIdRef = useRef<string | null | undefined>(undefined);
  const prevBoundsStrRef = useRef<string | null>(null);
  
  // Create stable primitive dependencies to prevent infinite render loops
  // center is a new array every render, bounds is a new L.LatLngBounds every render
  const centerStr = center ? `${center[0]},${center[1]}` : null;
  const boundsStr = bounds ? bounds.toBBoxString() : null;
  const activeItemId = activeItem?.id;

  useEffect(() => {
    const anyMap = map as any;
    anyMap?.stop?.();

    if (activeItem && activeItem.lat != null && activeItem.lng != null) {
      // Must cast to Number because Google Places/Supabase string representations crash Leaflet's flyTo math
      const targetLat = Number(activeItem.lat);
      const targetLng = Number(activeItem.lng);
      const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 13;
      const currentCenter = typeof anyMap?.getCenter === 'function' ? anyMap.getCenter() : null;
      const distDeg = currentCenter
        ? Math.hypot(targetLat - Number(currentCenter.lat), targetLng - Number(currentCenter.lng))
        : 1;

      if (distDeg < 0.05) {
        if (currentZoom >= 15) {
          map.panTo([targetLat, targetLng], { animate: true, duration: 0.45, easeLinearity: 0.25 });
        } else {
          map.setView([targetLat, targetLng], 15, { animate: true, duration: 0.5 } as any);
        }
      } else {
        map.flyTo([targetLat, targetLng], 15, {
          animate: true,
          duration: 0.75,
          easeLinearity: 0.25,
        });
      }
    } else if (bounds && bounds.isValid()) {
      if (prevBoundsStrRef.current !== boundsStr || prevActiveIdRef.current != null) {
        map.fitBounds(bounds, { padding: [56, 56], maxZoom: 15, animate: true, duration: 0.6 } as any);
      }
    } else if (center) {
      map.setView(center, map.getZoom(), { animate: true });
    }

    prevActiveIdRef.current = activeItemId ?? null;
    prevBoundsStrRef.current = boundsStr;
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

export interface LegRouteInfo {
  geometry: [number, number][];
  duration: number;
  distance: number;
  mode: string;
  isFallback?: boolean;
}

export const LEG_ROUTE_CACHE = new Map<string, LegRouteInfo>();

const buildLegCacheKey = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  mode: string
): string =>
  `${lat1.toFixed(5)},${lng1.toFixed(5)}->${lat2.toFixed(5)},${lng2.toFixed(5)}:${mode}`;

const fetchLegRoute = (
  stop1: ItineraryItem,
  stop2: ItineraryItem,
  mode: string
): Promise<LegRouteInfo> => {
  const lat1 = Number(stop1.lat);
  const lng1 = Number(stop1.lng);
  const lat2 = Number(stop2.lat);
  const lng2 = Number(stop2.lng);

  if (mode === 'flight') {
    return Promise.resolve({
      geometry: [[lat1, lng1], [lat2, lng2]],
      duration: 0,
      distance: 0,
      mode,
      isFallback: false,
    });
  }

  return fetchOSRM(lat1, lng1, lat2, lng2, mode);
};

type OsrmProfile = 'foot' | 'bicycle' | 'driving';

const haversineMeters = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// FOSSGIS OSRM hosts separate foot/bike/car graphs (router.project-osrm.org only has a car graph)
const buildOsrmRouteUrl = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  profile: OsrmProfile,
  overview: 'full' | 'false' = 'full'
): string => {
  const service = profile === 'foot' ? 'routed-foot' : profile === 'bicycle' ? 'routed-bike' : 'routed-car';
  return `https://routing.openstreetmap.de/${service}/route/v1/${profile}/${lng1},${lat1};${lng2},${lat2}?overview=${overview}&geometries=geojson`;
};

const fetchOSRM = async (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  mode: string
): Promise<LegRouteInfo> => {
  const cacheKey = buildLegCacheKey(lat1, lng1, lat2, lng2, mode);
  const cached = LEG_ROUTE_CACHE.get(cacheKey);
  if (cached && !cached.isFallback) {
    return cached;
  }

  let initialProfile: OsrmProfile = 'driving';
  if (mode === 'walking') initialProfile = 'foot';
  else if (mode === 'bicycling') initialProfile = 'bicycle';

  const directMeters = haversineMeters(lat1, lng1, lat2, lng2);
  // Car-free zones (e.g. Zermatt) make the car graph snap both stops to the same road: retry on foot once.
  const profiles: OsrmProfile[] = initialProfile === 'driving' ? ['driving', 'foot'] : [initialProfile];

  try {
    for (const profile of profiles) {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? window.setTimeout(() => controller.abort(), 4000) : null;
      let data: any;
      try {
        const res = await fetch(
          buildOsrmRouteUrl(lat1, lng1, lat2, lng2, profile),
          controller ? { signal: controller.signal } : undefined
        );
        data = await res.json();
      } finally {
        if (timeoutId !== null) window.clearTimeout(timeoutId);
      }
      if (!(data && data.code === 'Ok' && data.routes?.[0])) continue;

      const route = data.routes[0];
      let geometry: [number, number][] = (route.geometry?.coordinates ?? []).map((c: any[]) => [c[1], c[0]] as [number, number]);

      // Reject degenerate responses (0-length route between distinct stops)
      if (geometry.length < 2 || (directMeters > 15 && !(route.distance > 0))) continue;

      // Anchor the road geometry to the marker pins so there are no mid-air gaps
      if (haversineMeters(geometry[0][0], geometry[0][1], lat1, lng1) > 10) geometry = [[lat1, lng1], ...geometry];
      const last = geometry[geometry.length - 1];
      if (haversineMeters(last[0], last[1], lat2, lng2) > 10) geometry = [...geometry, [lat2, lng2]];

      // Compute realistic travel time for each specific mode based on road network distance
      let calculatedDuration = route.duration;
      const distanceM = route.distance || 0;

      if (mode === 'walking') {
        // Average walking speed: 4.5 km/h (1.25 m/s)
        calculatedDuration = Math.round(distanceM / 1.25);
      } else if (mode === 'bicycling') {
        // Average city cycling speed: 15 km/h (4.16 m/s)
        calculatedDuration = Math.round(distanceM / 4.16);
      } else if (mode === 'transit') {
        // Public transit (bus/metro) includes stop wait times and transfers (~1.5x driving time + 4 mins buffer)
        calculatedDuration = Math.max(Math.round(route.duration * 1.5 + 240), Math.round(distanceM / 5.5));
      } else {
        // Driving: use OSRM driving duration
        calculatedDuration = route.duration;
      }

      const result: LegRouteInfo = {
        geometry,
        duration: calculatedDuration,
        distance: route.distance,
        mode,
        isFallback: false,
      };
      LEG_ROUTE_CACHE.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.error("OSRM fetch error", err);
  }

  return {
    geometry: [[lat1, lng1], [lat2, lng2]],
    duration: 0,
    distance: 0,
    mode,
    isFallback: true,
  };
};

export const MapView: React.FC<Props> = ({ items, onAddSearchResult, activeItemId, onMarkerClick, hasBottomCards }) => {
  const { language } = useTranslation();
  const isEn = language?.startsWith('en');

  const [legsRouteInfo, setLegsRouteInfo] = useState<LegRouteInfo[]>([]);

  const [routingModeOverride, setRoutingModeOverride] = useState<'auto' | 'driving' | 'walking' | 'bicycling' | 'transit'>('auto');
  const [isRoutingMenuOpen, setIsRoutingMenuOpen] = useState(false);
  const routingMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRoutingMenuOpen) return;
    const handlePointerDownOutside = (e: MouseEvent | PointerEvent) => {
      if (routingMenuRef.current && !routingMenuRef.current.contains(e.target as Node)) {
        setIsRoutingMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => document.removeEventListener('pointerdown', handlePointerDownOutside);
  }, [isRoutingMenuOpen]);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const updateTheme = () => setIsDarkMode(root.classList.contains('dark'));
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [mapRef, setMapRef] = useState<L.Map | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      // 1. Resolve raw coordinates or Google Maps URL using mapUrlService (prioritizing exact POI pin coordinates)
      const resolved = resolveLocationInput(searchQuery);
      if (resolved) {
        let addressNotice = isEn ? 'Location from Google Maps' : '來自 Google Maps 的定位';
        if (resolved.source === 'data_pin') {
          addressNotice = isEn ? 'Exact Pin Location (Google Maps)' : 'Google Maps 精確標記位置';
        } else if (resolved.source === 'raw_coords') {
          addressNotice = isEn ? 'Pasted Coordinates' : '貼上的自訂座標';
        }

        setSearchResults([{
          display_name: resolved.placeName,
          address: addressNotice,
          lat: resolved.lat,
          lon: resolved.lng,
          source: resolved.source === 'raw_coords' ? 'raw_coords' : 'google_url',
        }]);
        setIsSearching(false);
        return;
      }

      // 2. Check existing items in itinerary to allow quick jumps
      const existingMatches = items.filter(i => 
        i.placeName && 
        i.placeName.toLowerCase().includes(searchQuery.toLowerCase()) && 
        i.lat != null && 
        i.lng != null &&
        i.type !== 'Transport'
      );

      const itineraryMatches: any[] = [];
      if (existingMatches.length > 0) {
        const seen = new Set();
        for (const match of existingMatches) {
          if (!seen.has(match.placeName)) {
            seen.add(match.placeName);
            itineraryMatches.push({
               display_name: match.placeName,
               address: isEn ? 'From your itinerary' : '來自你的行程',
               lat: match.lat,
               lon: match.lng,
               source: 'itinerary',
            });
          }
        }
        
        const exactMatch = itineraryMatches.find(m => m.display_name.toLowerCase() === searchQuery.toLowerCase());
        if (exactMatch) {
            setSearchResults([exactMatch]);
            setIsSearching(false);
            return;
        }
      }

      // 3. Free Multi-Engine Search (Komoot Photon + OSM Nominatim, with Viewbox/Proximity Bias)
      // Zero Google API tokens consumed!
      let mapCenterLat: number | undefined;
      let mapCenterLng: number | undefined;
      let viewbox: { west: number; south: number; east: number; north: number } | undefined;

      if (mapRef) {
        try {
          const center = mapRef.getCenter();
          mapCenterLat = center.lat;
          mapCenterLng = center.lng;

          const bounds = mapRef.getBounds();
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          viewbox = {
            west: sw.lng,
            south: sw.lat,
            east: ne.lng,
            north: ne.lat,
          };
        } catch(e) {}
      }

      const freePlaces = await searchFreePlaces(searchQuery, {
        lat: mapCenterLat,
        lng: mapCenterLng,
        viewbox,
        language: language === 'en' ? 'en' : 'zh-TW',
        limit: 6,
      });

      const freeItems = freePlaces.map(r => ({
        display_name: r.title,
        address: r.subtitle,
        lat: r.lat,
        lon: r.lon ?? r.lng,
        source: r.source,
        distanceKm: r.distanceKm,
      }));

      const combinedResults = [...itineraryMatches, ...freeItems];

      if (combinedResults.length === 0) {
        if (searchQuery.includes('maps.app.goo.gl')) {
          setSearchResults([{
            display_name: isEn ? 'Please use full Google Maps URL' : '請使用完整 Google Maps 網址',
            lat: '0', lon: '0',
            isErrorHint: true,
            hint: isEn ? 'Short URLs cannot be resolved directly due to CORS. Please open it in a browser and paste the full URL (containing @ coordinates).' : '短網址因安全限制無法直接解析。請在瀏覽器點開連結後，複製網址列的「完整網址」（包含座標），直接貼上即可！'
          }]);
        } else {
          setSearchResults([{
            display_name: isEn ? 'No places found' : '找不到相關地點',
            lat: '0', lon: '0',
            isErrorHint: true,
            hint: isEn ? 'Try typing the local or English name, or paste a Google Maps link.' : '找不到此地點。可嘗試輸入當地英文名稱，或直接貼上 Google Maps 景點網址！'
          }]);
        }
      } else {
        setSearchResults(combinedResults);
      }
    } catch (e) {
      console.error('Search error:', e);
    }
    setIsSearching(false);
  };

  const handleAddResult = (result: any) => {
    if (result.isErrorHint) return; // Prevent adding if it's just an error hint message

    const latNum = typeof result.lat === 'number' ? result.lat : parseFloat(result.lat);
    const lonNum = typeof result.lon === 'number' ? result.lon : parseFloat(result.lon);

    if (mapRef && !isNaN(latNum) && !isNaN(lonNum)) {
      mapRef.flyTo([latNum, lonNum], Math.max(mapRef.getZoom(), 15), { duration: 1 });
    }

    if(onAddSearchResult && !isNaN(latNum) && !isNaN(lonNum)) {
      onAddSearchResult(result.display_name.split(',')[0], latNum, lonNum);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  // Filter out any items where lat or lng is missing, null, or undefined
  const validItems = useMemo(
    () =>
      items.filter(
        i =>
          i.lat != null &&
          i.lng != null &&
          !isNaN(i.lat) &&
          !isNaN(i.lng) &&
          i.type !== 'Transport'
      ),
    [items]
  );
  const pathPositions: [number, number][] = useMemo(
    () => validItems.map(i => [Number(i.lat), Number(i.lng)]),
    [validItems]
  );
  
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

  const plannedLegs = useMemo(() => {
    if (validItems.length < 2) return [];
    const legs: {
      stop1: ItineraryItem;
      stop2: ItineraryItem;
      lat1: number;
      lng1: number;
      lat2: number;
      lng2: number;
      mode: string;
      cacheKey: string;
    }[] = [];
    for (let idx = 0; idx < validItems.length - 1; idx++) {
      const stop1 = validItems[idx];
      const stop2 = validItems[idx + 1];
      const lat1 = Number(stop1.lat);
      const lng1 = Number(stop1.lng);
      const lat2 = Number(stop2.lat);
      const lng2 = Number(stop2.lng);
      const mode = getLegMode(stop1, stop2);
      legs.push({
        stop1,
        stop2,
        lat1,
        lng1,
        lat2,
        lng2,
        mode,
        cacheKey: buildLegCacheKey(lat1, lng1, lat2, lng2, mode),
      });
    }
    return legs;
  }, [validItems, items, routingModeOverride]);

  const legsSignature = useMemo(
    () => plannedLegs.map((l) => l.cacheKey).join('|'),
    [plannedLegs]
  );

  // Fetch routing data leg-by-leg whenever stops or per-leg/override transport modes change
  useEffect(() => {
    if (plannedLegs.length === 0) {
      setLegsRouteInfo([]);
      return;
    }

    // Seed immediately from cache or straight-line fallback so route lines never vanish during fetches
    const immediateLegs: LegRouteInfo[] = plannedLegs.map((leg) => {
      const cached = LEG_ROUTE_CACHE.get(leg.cacheKey);
      if (cached && !cached.isFallback) return cached;
      return {
        geometry: [[leg.lat1, leg.lng1], [leg.lat2, leg.lng2]],
        duration: 0,
        distance: 0,
        mode: leg.mode,
        isFallback: leg.mode !== 'flight',
      };
    });
    setLegsRouteInfo(immediateLegs);

    const needsFetch = immediateLegs.some((leg) => leg.isFallback);
    if (!needsFetch) return;

    let cancelled = false;
    const BATCH_SIZE = 3;
    const fetchAllLegs = async () => {
      try {
        const currentLegs = [...immediateLegs];
        const pendingIdx = currentLegs
          .map((leg, idx) => (leg.isFallback ? idx : -1))
          .filter((idx) => idx !== -1);

        for (let i = 0; i < pendingIdx.length; i += BATCH_SIZE) {
          if (cancelled) return;
          const batch = pendingIdx.slice(i, i + BATCH_SIZE);
          const results = await Promise.all(
            batch.map((idx) => {
              const leg = plannedLegs[idx];
              return fetchLegRoute(leg.stop1, leg.stop2, leg.mode);
            })
          );
          if (cancelled) return;
          batch.forEach((idx, k) => {
            currentLegs[idx] = results[k];
          });
          setLegsRouteInfo([...currentLegs]);
        }
      } catch (err) {
        console.error("Error fetching all legs route info", err);
      }
    };

    fetchAllLegs();
    return () => {
      cancelled = true;
    };
  }, [legsSignature]);

  const activeItem = validItems.find(i => i.id === activeItemId);

  return (
    <div className="w-full h-full rounded-2xl sm:rounded-[32px] overflow-hidden shadow-sm border border-slate-100 dark:border-white/[0.08] relative z-0 bg-slate-50 dark:bg-[#0c0d12] group">
      
      {/* Search Overlay */}
      <div className="absolute top-4 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[340px] z-[1000] flex flex-col gap-2 pointer-events-none transition-all duration-300">
         <form onSubmit={handleSearch} className="flex gap-2 pointer-events-auto relative">
            <input 
              type="text" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={isEn ? "Search places to add..." : "搜尋地點以快速加入..."} 
              className="flex-1 bg-white/95 dark:bg-[#121318]/95 backdrop-blur-2xl shadow-lg rounded-2xl pl-10 pr-4 py-3 sm:py-3.5 text-xs sm:text-sm font-bold border transform transition-all focus:scale-[1.02] border-slate-100 dark:border-white/[0.12] outline-none focus:ring-4 focus:ring-primary/20 dark:text-white"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </div>
         </form>
         {searchResults.length > 0 && (
           <div className="bg-white/95 dark:bg-[#121318]/95 backdrop-blur-2xl shadow-2xl shadow-black/10 rounded-2xl p-2 overflow-hidden pointer-events-auto max-h-72 overflow-y-auto custom-scrollbar flex flex-col gap-1 border border-slate-100 dark:border-white/[0.12] animate-in fade-in slide-in-from-top-2">
             <div className="flex justify-between items-center px-3 pt-1 pb-2 border-b border-slate-100 dark:border-white/[0.08] mb-1">
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{isEn ? 'Search Results' : '搜尋結果'}</span>
               <button onClick={() => setSearchResults([])} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-[10px] uppercase font-bold">{isEn ? 'Close' : '關閉'}</button>
             </div>
             {searchResults.map((r, i) => (
               <button 
                 key={i} 
                 onClick={() => handleAddResult(r)} 
                 className={`text-left px-3 py-2.5 rounded-xl transition-all flex flex-col ${r.isErrorHint ? 'bg-amber-50/60 dark:bg-amber-950/20 cursor-default' : 'hover:bg-slate-50 dark:hover:bg-white/[0.06] active:scale-95'}`}
               >
                 <div className="flex items-center justify-between gap-2">
                   <span className="font-black text-sm text-slate-800 dark:text-slate-100 line-clamp-1">{r.display_name.split(',')[0]}</span>
                   {r.source === 'google_url' && (
                     <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shrink-0">Google Maps</span>
                   )}
                   {r.source === 'raw_coords' && (
                     <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shrink-0">{isEn ? 'Coords' : '自訂座標'}</span>
                   )}
                   {r.source === 'photon' && (
                     <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 shrink-0">Photon</span>
                   )}
                   {r.source === 'osm' && (
                     <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 shrink-0">OSM</span>
                   )}
                   {r.source === 'itinerary' && (
                     <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 shrink-0">{isEn ? 'Itinerary' : '行程景點'}</span>
                   )}
                 </div>
                 {r.isErrorHint ? (
                   <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 whitespace-normal mt-0.5 leading-tight">{r.hint}</span>
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
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100/50 dark:bg-black/60 z-20">
          <div className="w-16 h-16 bg-white dark:bg-[#161822] rounded-full shadow-lg flex items-center justify-center border border-slate-100 dark:border-white/[0.1] mb-4 animate-bounce-soft">
            <MapPin size={24} className="text-slate-400" />
          </div>
          <p className="text-xs text-slate-400 mt-2 max-w-[200px] text-center">
            {isEn ? 'Add places with valid coordinates to see them mapped here.' : '新增帶有坐標的地點即可在地圖上查看。'}
          </p>
        </div>
      ) : (
      <>
        {/* Travel Mode Selector Overlay (Collapsed by default, horizontally aligned with mobile stops pill) */}
        <div
          ref={routingMenuRef}
          data-testid="routing-mode-selector"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={`absolute ${
            hasBottomCards ? 'bottom-[130px] lg:bottom-4' : 'bottom-3 lg:bottom-4'
          } left-3 lg:left-4 z-[1000] pointer-events-auto h-8 flex items-center gap-1 bg-white/95 dark:bg-[#121318]/90 backdrop-blur-2xl shadow-lg rounded-full p-[3px] border border-black/[0.06] dark:border-white/[0.12] transition-all duration-200`}
        >
          {[
            {
              mode: 'auto' as const,
              icon: Route,
              title: isEn ? 'Auto (by Itinerary)' : '自動 (依行程)',
              activeClass: 'bg-violet-600 text-white shadow-sm',
            },
            {
              mode: 'driving' as const,
              icon: Car,
              title: isEn ? 'Always Driving' : '全域開車',
              activeClass: 'bg-slate-600 dark:bg-white/[0.2] text-white shadow-sm',
            },
            {
              mode: 'walking' as const,
              icon: Footprints,
              title: isEn ? 'Always Walking' : '全域走路',
              activeClass: 'bg-amber-500 text-white shadow-sm',
            },
            {
              mode: 'transit' as const,
              icon: TrainFront,
              title: isEn ? 'Always Transit' : '全域大眾運輸',
              activeClass: 'bg-indigo-500 text-white shadow-sm',
            },
            {
              mode: 'bicycling' as const,
              icon: Bike,
              title: isEn ? 'Always Cycling' : '全域自行車',
              activeClass: 'bg-emerald-500 text-white shadow-sm',
            },
          ]
            .filter((opt) => isRoutingMenuOpen || opt.mode === routingModeOverride)
            .map((opt, idx) => {
              const Icon = opt.icon;
              const isActive = routingModeOverride === opt.mode;
              return (
                <React.Fragment key={opt.mode}>
                  {isRoutingMenuOpen && idx === 1 && (
                    <div className="w-px h-4 bg-slate-200 dark:bg-white/[0.12] mx-0.5" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!isRoutingMenuOpen) {
                        setIsRoutingMenuOpen(true);
                      } else {
                        setRoutingModeOverride(opt.mode);
                        setIsRoutingMenuOpen(false);
                      }
                    }}
                    title={opt.title}
                    aria-label={opt.title}
                    aria-expanded={isActive ? isRoutingMenuOpen : undefined}
                    className={`w-6 h-6 rounded-full transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
                      isActive
                        ? opt.activeClass
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                    }`}
                  >
                    <Icon size={14} />
                  </button>
                </React.Fragment>
              );
            })}
        </div>

        <MapContainer ref={setMapRef} center={center} zoom={13} preferCanvas={true} style={{ height: '100%', width: '100%', zIndex: 0 }} zoomControl={false}>
        {/* 100% Free Watermark-Free OpenStreetMap Basemap (Dark Mode Styled via Calibrated Slate-Navy Filter) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <MapResizer />
        {validItems.length > 0 && <ChangeView bounds={bounds} activeItem={activeItem} />}
        
        {/* Draw the connected route legs with dual-layer Flighty glowing casing */}
        {legsRouteInfo && legsRouteInfo.length > 0 ? (
          legsRouteInfo.map((leg, idx) => {
            let color = isDarkMode ? '#38BDF8' : '#0284C7'; // Sky Blue (Driving / default)
            let dashArray = undefined;
            let weight = 4;
            let opacity = 0.92;

            if (leg.mode === 'walking') {
              color = isDarkMode ? '#FBBF24' : '#F59E0B'; // Amber
              dashArray = '5, 8'; // Dotted/dashed
              weight = 4;
            } else if (leg.mode === 'transit') {
              color = isDarkMode ? '#818CF8' : '#6366F1'; // Indigo
              dashArray = '10, 10';
              weight = 4;
            } else if (leg.mode === 'bicycling') {
              color = isDarkMode ? '#34D399' : '#10B981'; // Emerald
              weight = 4;
            } else if (leg.mode === 'flight') {
              color = isDarkMode ? '#60A5FA' : '#3B82F6'; // Blue
              dashArray = '5, 10';
              weight = 3;
              opacity = 0.78;
            }

            return (
              <React.Fragment key={`leg-route-${idx}`}>
                <Polyline
                  positions={leg.geometry}
                  pathOptions={{
                    color,
                    weight: weight + 3,
                    opacity: isDarkMode ? 0.18 : 0.12,
                  }}
                />
                <Polyline
                  positions={leg.geometry}
                  pathOptions={{ color, weight, opacity, dashArray }}
                />
              </React.Fragment>
            );
          })
        ) : pathPositions.length > 1 ? (
          <>
            <Polyline
              positions={pathPositions}
              pathOptions={{
                color: isDarkMode ? '#38BDF8' : '#0284C7',
                weight: 6,
                opacity: isDarkMode ? 0.18 : 0.12,
              }}
            />
            <Polyline
              positions={pathPositions}
              pathOptions={{
                color: isDarkMode ? '#38BDF8' : '#0284C7',
                weight: 3,
                opacity: 0.92,
                dashArray: '10, 10',
              }}
            />
          </>
        ) : null}

        {/* Draw Driving Times between stops (decluttered on multi-stop days > 4 stops unless connected to active stop) */}
        {legsRouteInfo && legsRouteInfo.length > 0 && validItems.length > 1 && validItems.map((item, idx) => {
           if (idx === validItems.length - 1) return null;
           const nextItem = validItems[idx + 1];
           const isConnectedToActive =
             activeItemId != null &&
             (item.id === activeItemId || nextItem?.id === activeItemId);
           if (validItems.length > 4 && !isConnectedToActive) return null;

           const leg = legsRouteInfo[idx];
           if (!leg || !leg.geometry || leg.geometry.length < 2) return null;
           
           // Calculate midpoint of the route geometry instead of straight line midpoint for better accuracy!
           const midPointIdx = Math.floor(leg.geometry.length / 2);
           const [midLat, midLng] = leg.geometry[midPointIdx];
           
           if ((!leg.duration || leg.duration <= 0) && leg.mode !== 'flight') return null; // hide if fallback/0 duration except for flight
           const mins = Math.max(1, Math.round(leg.duration / 60)); // Minimum 1 min
           
           let modeIcon = MODE_ICON_HTML.driving;
           let modeText = isEn ? 'Drive' : '車程';
           let iconColorClass = 'text-sky-400';
           
           if (leg.mode === 'walking') {
             modeIcon = MODE_ICON_HTML.walking;
             modeText = isEn ? 'Walk' : '步行';
             iconColorClass = 'text-amber-400';
           } else if (leg.mode === 'transit') {
             modeIcon = MODE_ICON_HTML.transit;
             modeText = isEn ? 'Transit' : '乘車';
             iconColorClass = 'text-indigo-400';
           } else if (leg.mode === 'bicycling') {
             modeIcon = MODE_ICON_HTML.bicycling;
             modeText = isEn ? 'Bike' : '騎車';
             iconColorClass = 'text-emerald-400';
           } else if (leg.mode === 'flight') {
             modeIcon = MODE_ICON_HTML.flight;
             modeText = isEn ? 'Flight' : '飛行';
             iconColorClass = 'text-blue-400';
           }
           
           let timeText = '';
           if (mins >= 60) {
             const hrs = Math.floor(mins / 60);
             const remMins = mins % 60;
             timeText = isEn 
               ? (remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`)
               : (remMins > 0 ? `${hrs}小時${remMins}分` : `${hrs}小時`);
           } else {
             timeText = `${mins} ${isEn ? 'min' : '分鐘'}`;
           }

           const displayStr = leg.mode === 'flight' 
             ? modeText
             : `${modeText} ${timeText}`;
           
           return (
             <Marker 
               key={`duration-${idx}`} 
               position={[midLat, midLng]}
               zIndexOffset={100}
               icon={getDurationDivIcon(iconColorClass, modeIcon, displayStr)}
             />
           );
        })}

        {/* Draw the markers last so they sit on top of the line */}
        {validItems.map((item, idx) => (
          <Marker 
            key={item.id} 
            position={[Number(item.lat!), Number(item.lng!)]}
            icon={createCustomIcon(idx, item.type, item.id === activeItemId)}
            zIndexOffset={item.id === activeItemId ? 1000 : idx * 10}
            eventHandlers={{
              click: () => onMarkerClick && onMarkerClick(item.id)
            }}
          >
            <Popup className="custom-popup" closeButton={false}>
              <div className="p-1 px-2 min-w-[120px]">
                <div className="flex items-center gap-2 mb-1.5 border-b border-slate-100 dark:border-white/[0.1] pb-1.5">
                  <div className={`px-1.5 py-0.5 rounded text-[10px] font-black font-mono tabular-nums ${item.transportType === 'Flight' ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300' : item.type === 'Food' ? 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300' : 'bg-indigo-100 text-primary dark:bg-primary/20 dark:text-sky-300'}`}>
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
