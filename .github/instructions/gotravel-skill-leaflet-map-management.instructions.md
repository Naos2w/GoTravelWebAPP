---
applyTo: "components/MapView.tsx"
---
# Skill Mapping: leaflet-map-management

The `go-travel` application uses `react-leaflet` to display interactive maps of trip itineraries. To ensure smooth performance, avoid map container crashes, and manage markers efficiently, follow these rules.

## Map Lifecycle and Instance Reuse
- Always check if the map container reference is available before calling map functions.
- Do not instantiate raw Leaflet map objects directly in React components. Always use `<MapContainer>`, `<TileLayer>`, and child elements provided by `react-leaflet`.
- Use the `whenReady` callback or a React `ref` on `<MapContainer>` to retrieve the raw Leaflet map instance safely if imperatively updating views (e.g. centering the map).

## Markers and Performance
- Ensure that markers have unique `key` props (typically the itinerary destination ID or flight ID).
- Avoid rendering hundreds of markers at once; filter markers based on active filters (e.g., specific day selection or location category).
- Keep custom marker icon definitions cached or defined outside the component render function to prevent recreations on every paint.

## Custom Leaflet Controls
- Use `react-leaflet-custom-control` or custom positioning div elements inside the `<MapContainer>` overlay to overlay custom controls (e.g., zoom buttons, layer selection).
- Maintain responsiveness of overlays so they do not block core map touch inputs on mobile devices.
