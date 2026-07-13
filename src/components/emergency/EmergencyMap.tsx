import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons for Leaflet + bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const createColorIcon = (color: string) => {
  return L.divIcon({
    html: `<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="${color}" stroke="white" stroke-width="2"/>
            <circle cx="12" cy="9" r="3" fill="white"/>
          </svg>`,
    className: "custom-marker-icon",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

const userIcon = createColorIcon("#3b82f6"); // Blue
const hospitalIcon = createColorIcon("#ef4444"); // Red
const pharmacyIcon = createColorIcon("#22c55e"); // Green

interface Hospital {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  distance: number;
  phone?: string;
  type?: 'hospital' | 'pharmacy' | 'clinic';
}

interface EmergencyMapProps {
  userLocation: { lat: number; lng: number } | null;
  hospitals: Hospital[];
  selectedHospitalId: string | null;
  onSelectHospital: (id: string) => void;
}

export const EmergencyMap = ({ userLocation, hospitals, selectedHospitalId, onSelectHospital }: EmergencyMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const prevSelectedRef = useRef<string | null>(null);
  const routeLayerRef = useRef<L.GeoJSON | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialLat = userLocation?.lat || 20.5937;
    const initialLng = userLocation?.lng || 78.9629;
    const initialZoom = userLocation ? 12 : 4;

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    if (userLocation) {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup("<strong>Your Location</strong>");
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      userMarkerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []); // Run only once to initialize map

  // Handle userLocation updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    
    map.setView([userLocation.lat, userLocation.lng], 12);
    
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    } else {
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup("<strong>Your Location</strong>");
    }
  }, [userLocation?.lat, userLocation?.lng]);

  // Update hospital markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old hospital markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    hospitals.forEach((h) => {
      if (!h.latitude || !h.longitude) return;
      
      const icon = h.type === 'hospital' ? hospitalIcon : 
                   (h.type === 'pharmacy' || h.type === 'clinic') ? pharmacyIcon : 
                   hospitalIcon;

      const marker = L.marker([Number(h.latitude), Number(h.longitude)], { icon })
        .addTo(map)
        .bindPopup(
          `<div style="font-size:13px"><strong>${h.name}</strong><br/>${h.distance.toFixed(1)} km away${
            h.phone ? `<br/><a href="tel:${h.phone}">${h.phone}</a>` : ""
          }</div>`
        )
        .on("click", () => onSelectHospital(h.id));
      markersRef.current.set(h.id, marker);
    });
  }, [hospitals, onSelectHospital]);

  // Fly to selected hospital
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedHospitalId || selectedHospitalId === prevSelectedRef.current) return;
    prevSelectedRef.current = selectedHospitalId;

    const hospital = hospitals.find((h) => h.id === selectedHospitalId);
    if (hospital?.latitude && hospital?.longitude) {
      if (userLocation) {
        const bounds = L.latLngBounds(
          [userLocation.lat, userLocation.lng],
          [hospital.latitude, hospital.longitude]
        );
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });

        // Clear existing route if any
        if (routeLayerRef.current) {
          map.removeLayer(routeLayerRef.current);
          routeLayerRef.current = null;
        }

        // Fetch new driving route
        const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${hospital.longitude},${hospital.latitude}?overview=full&geometries=geojson`;
        fetch(url)
          .then((res) => res.json())
          .then((data) => {
            if (data.routes && data.routes[0]) {
              const route = data.routes[0].geometry;
              routeLayerRef.current = L.geoJSON(route, {
                style: {
                  color: "#3b82f6", // Nice GPS blue
                  weight: 5,
                  opacity: 0.8,
                }
              }).addTo(map);
            }
          })
          .catch(console.error);
      } else {
        map.setView([hospital.latitude, hospital.longitude], 14);
      }

      // Open popup
      const marker = markersRef.current.get(selectedHospitalId);
      marker?.openPopup();
    }
  }, [selectedHospitalId, hospitals, userLocation]);

  return (
    <div
      ref={containerRef}
      className="rounded-lg overflow-hidden border border-border shadow-sm relative z-0"
      style={{ height: 280 }}
    />
  );
};
