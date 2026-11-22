import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { inr, Txn } from "./api";

interface TransactionMapProps {
  currentTxn?: Txn | null;
  historicalTxns?: Txn[];
  height?: number;
}

// Major banking corridor reference hubs in India
const BANKING_HUBS: Record<string, { lat: number; lon: number; label: string }> = {
  Coimbatore: { lat: 11.0168, lon: 76.9558, label: "Coimbatore" },
  Chennai: { lat: 13.0827, lon: 80.2707, label: "Chennai" },
  Bengaluru: { lat: 12.9716, lon: 77.5946, label: "Bengaluru" },
  Hyderabad: { lat: 17.385, lon: 78.4867, label: "Hyderabad" },
  Mumbai: { lat: 19.076, lon: 72.8777, label: "Mumbai" },
  Pune: { lat: 18.5204, lon: 73.8567, label: "Pune" },
  Delhi: { lat: 28.6139, lon: 77.209, label: "New Delhi" },
  Kolkata: { lat: 22.5726, lon: 88.3639, label: "Kolkata" },
  Kochi: { lat: 9.9312, lon: 76.2673, label: "Kochi" },
  Ahmedabad: { lat: 23.0225, lon: 72.5714, label: "Ahmedabad" },
  Jaipur: { lat: 26.9124, lon: 75.7873, label: "Jaipur" },
};

export const TransactionMap: React.FC<TransactionMapProps> = ({
  currentTxn,
  historicalTxns = [],
  height = 440,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [mapStyle, setMapStyle] = useState<"osm" | "esri">("osm");
  const [selectedInfo, setSelectedInfo] = useState<string | null>(null);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Center on India
    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: false,
      attributionControl: true,
    });

    // Add zoom control to top-right
    L.control.zoom({ position: "topright" }).addTo(map);

    // Initial tile layer (OpenStreetMap: 100% free, detailed streets, NO API key required)
    const tileUrl =
      mapStyle === "osm"
        ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution:
        mapStyle === "osm"
          ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          : 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, METI, TomTom',
      subdomains: ["a", "b", "c"],
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Layer group for dynamic markers and route polylines
    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle Tile Style Toggle (OpenStreetMap vs Esri World Street)
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current) return;
    mapRef.current.removeLayer(tileLayerRef.current);

    const tileUrl =
      mapStyle === "osm"
        ? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}";

    const newTileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution:
        mapStyle === "osm"
          ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          : 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, METI, TomTom',
      subdomains: ["a", "b", "c"],
    }).addTo(mapRef.current);

    tileLayerRef.current = newTileLayer;
  }, [mapStyle]);

  // Update Markers, Route Vector, and Bounds whenever currentTxn or historicalTxns change
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // 1. Plot Reference Corridor Hubs (Subtle gray circles for geographic orientation)
    Object.values(BANKING_HUBS).forEach((hub) => {
      const hubIcon = L.divIcon({
        className: "banking-hub-dot",
        html: `<div style="width: 6px; height: 6px; background: #94A3B8; border-radius: 50%; opacity: 0.6;"></div>`,
        iconSize: [6, 6],
        iconAnchor: [3, 3],
      });
      L.marker([hub.lat, hub.lon], { icon: hubIcon, interactive: false }).addTo(layerGroup);
    });

    const boundsPoints: L.LatLngExpression[] = [];

    // Derive current coordinates
    const curLat = currentTxn?.lat ?? (currentTxn?.city ? BANKING_HUBS[currentTxn.city]?.lat : undefined);
    const curLon = currentTxn?.lon ?? (currentTxn?.city ? BANKING_HUBS[currentTxn.city]?.lon : undefined);

    // Derive previous coordinates
    const prevLat = currentTxn?.prev_lat ?? (currentTxn?.prev_city ? BANKING_HUBS[currentTxn.prev_city]?.lat : undefined);
    const prevLon = currentTxn?.prev_lon ?? (currentTxn?.prev_city ? BANKING_HUBS[currentTxn.prev_city]?.lon : undefined);

    const hasCurrent = typeof curLat === "number" && typeof curLon === "number";
    const hasPrevious = typeof prevLat === "number" && typeof prevLon === "number";

    // 2. Plot Previous Transaction Location (if exists)
    if (hasPrevious) {
      boundsPoints.push([prevLat!, prevLon!]);

      const prevIcon = L.divIcon({
        className: "custom-prev-pin",
        html: `
          <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
            <div style="width: 24px; height: 24px; background: #25162F; border: 2px solid #FFFFFF; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: 800;">
              1
            </div>
            <div style="position: absolute; bottom: -6px; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #25162F;"></div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 30],
        popupAnchor: [0, -28],
      });

      const prevMarker = L.marker([prevLat!, prevLon!], { icon: prevIcon }).addTo(layerGroup);
      prevMarker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 12px; padding: 4px;">
          <div style="font-size: 10px; color: #64748B; font-weight: 700; text-transform: uppercase;">Prior Transaction (Verified)</div>
          <b style="font-size: 13px; color: #25162F; display: block; margin: 2px 0;">${currentTxn?.prev_city ?? "Coimbatore"}</b>
          <div style="color: #475569;">Merchant: ${currentTxn?.prev_merchant ?? "Baseline Merchant"}</div>
          <div style="color: #64748B; font-size: 11px; margin-top: 2px;">Ref: ${currentTxn?.prev_txn_id ?? "Historical Baseline"}</div>
        </div>
      `);
    }

    // 3. Plot Current Transaction Location (Pulsing Pin with Risk Badge)
    if (hasCurrent) {
      boundsPoints.push([curLat!, curLon!]);

      const riskBand = currentTxn?.prediction?.risk_band ?? "low";
      const pinColor =
        riskBand === "high" || riskBand === "critical"
          ? "#DC2626" // Red
          : riskBand === "medium"
          ? "#D97706" // Amber
          : "#16A34A"; // Green

      const currentIcon = L.divIcon({
        className: "custom-current-pin",
        html: `
          <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 40px; height: 40px; border-radius: 50%; background: ${pinColor}; opacity: 0.25; animation: pulse 2s infinite ease-out;"></div>
            <div style="position: absolute; width: 28px; height: 28px; background: ${pinColor}; border: 3px solid #FFFFFF; border-radius: 50%; box-shadow: 0 4px 14px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; color: white; font-size: 12px; font-weight: 800;">
              2
            </div>
            <div style="position: absolute; bottom: 0px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid ${pinColor};"></div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 40],
        popupAnchor: [0, -36],
      });

      const curMarker = L.marker([curLat!, curLon!], { icon: currentIcon }).addTo(layerGroup);

      const speedText = currentTxn?.speed_kmh != null ? `${currentTxn.speed_kmh.toFixed(1)} km/h` : "N/A";
      const distText = currentTxn?.distance_from_prev_km != null ? `${currentTxn.distance_from_prev_km.toFixed(1)} km` : "N/A";

      curMarker.bindPopup(`
        <div style="font-family: system-ui, sans-serif; font-size: 13px; padding: 4px; min-width: 200px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 800; color: ${pinColor}; text-transform: uppercase;">
              ${riskBand.toUpperCase()} RISK (${((currentTxn?.prediction?.calibrated_score ?? 0.05) * 100).toFixed(1)}%)
            </span>
            <span style="font-size: 10px; background: #F1F5F9; padding: 2px 6px; border-radius: 4px; font-weight: 700;">
              ${currentTxn?.channel?.toUpperCase() ?? "POS"}
            </span>
          </div>
          <b style="font-size: 16px; color: #0F172A; display: block; margin: 2px 0;">
            ${inr(currentTxn?.amount ?? 0)}
          </b>
          <div style="color: #334155; font-size: 12px; margin-top: 2px;">
            <b>${currentTxn?.merchant_name ?? currentTxn?.merchant_id ?? "Direct Storefront"}</b>
          </div>
          <div style="color: #64748B; font-size: 11px; margin-top: 1px;">
            Terminal: <b>${currentTxn?.terminal_id ?? "N/A"}</b> · ${currentTxn?.city ?? "India"}
          </div>
          <hr style="border: 0; border-top: 1px solid #E2E8F0; margin: 8px 0;" />
          <div style="font-size: 11px; color: #475569; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
            <div>Speed: <b>${speedText}</b></div>
            <div>Distance: <b>${distText}</b></div>
          </div>
          ${
            currentTxn?.is_unusual_location
              ? `<div style="margin-top: 6px; font-size: 11px; color: #B91C1C; font-weight: 700;">⚠️ Unusual Location vs Cardholder Baseline</div>`
              : ""
          }
        </div>
      `).openPopup();
    }

    // 4. Draw Physical Transit Route Vector between Previous and Current Swipe
    if (hasCurrent && hasPrevious && (curLat !== prevLat || curLon !== prevLon)) {
      const isImpossible = (currentTxn?.speed_kmh ?? 0) > 800;
      const lineColor = isImpossible ? "#DC2626" : "#2563EB";

      const polyline = L.polyline(
        [
          [prevLat!, prevLon!],
          [curLat!, curLon!],
        ],
        {
          color: lineColor,
          weight: 4,
          opacity: 0.85,
          dashArray: isImpossible ? "8, 8" : undefined,
          smoothFactor: 1,
        }
      ).addTo(layerGroup);

      // Midpoint distance and speed tooltip tag
      const midLat = (prevLat! + curLat!) / 2;
      const midLon = (prevLon! + curLon!) / 2;

      const speedVal = currentTxn?.speed_kmh ?? 0;
      const distVal = currentTxn?.distance_from_prev_km ?? 0;

      const tagHtml = `
        <div style="background: white; border: 1.5px solid ${lineColor}; border-radius: 99px; padding: 3px 10px; font-size: 11px; font-weight: 700; color: ${lineColor}; box-shadow: 0 4px 10px rgba(0,0,0,0.15); white-space: nowrap;">
          ${distVal.toFixed(0)} km · ${speedVal.toFixed(0)} km/h ${isImpossible ? "🚨 IMPOSSIBLE SPEED" : "✅"}
        </div>
      `;

      const midpointIcon = L.divIcon({
        className: "route-midpoint-badge",
        html: tagHtml,
        iconSize: [120, 24],
        iconAnchor: [60, 12],
      });

      L.marker([midLat, midLon], { icon: midpointIcon, interactive: false }).addTo(layerGroup);
    }

    // 5. Auto Fit Bounds or Center
    if (boundsPoints.length >= 2) {
      map.fitBounds(boundsPoints as L.LatLngBoundsExpression, {
        padding: [60, 60],
        maxZoom: 12,
        animate: true,
        duration: 1.0,
      });
    } else if (boundsPoints.length === 1) {
      map.setView(boundsPoints[0], 11, { animate: true, duration: 1.0 });
    }
  }, [currentTxn, historicalTxns]);

  function resetView() {
    if (mapRef.current) {
      mapRef.current.setView([20.5937, 78.9629], 5, { animate: true, duration: 0.8 });
    }
  }

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid #CBD5E1",
        background: "#F8FAFC",
        height,
        boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.08)",
      }}
    >
      {/* Map Header Overlay */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 14,
          zIndex: 1000,
          display: "flex",
          gap: 10,
          alignItems: "center",
          background: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(6px)",
          padding: "8px 14px",
          borderRadius: 8,
          border: "1px solid #E2E8F0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#2563EB",
            boxShadow: "0 0 8px #2563EB",
          }}
        />
        <div>
          <b style={{ fontSize: 13, color: "#1E293B", letterSpacing: "0.2px" }}>
            BANK GIS GEOSPATIAL INTELLIGENCE RADAR
          </b>
          <span style={{ fontSize: 11, color: "#64748B", display: "block" }}>
            Real OpenStreetMap & Esri GIS tiles · Certified terminal coordinates
          </span>
        </div>
      </div>

      {/* Top-Right Style Toggle & Reset Controls */}
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 56, // to the left of leaflet zoom control
          zIndex: 1000,
          display: "flex",
          gap: 6,
          background: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(6px)",
          padding: 4,
          borderRadius: 8,
          border: "1px solid #E2E8F0",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <button
          type="button"
          onClick={() => setMapStyle("osm")}
          style={{
            border: 0,
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            background: mapStyle === "osm" ? "#25162F" : "transparent",
            color: mapStyle === "osm" ? "#FFFFFF" : "#64748B",
          }}
        >
          Street Map
        </button>
        <button
          type="button"
          onClick={() => setMapStyle("esri")}
          style={{
            border: 0,
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            background: mapStyle === "esri" ? "#25162F" : "transparent",
            color: mapStyle === "esri" ? "#FFFFFF" : "#64748B",
          }}
        >
          Esri World Map
        </button>
        <button
          type="button"
          onClick={resetView}
          title="Reset to India View"
          style={{
            border: "1px solid #CBD5E1",
            borderRadius: 6,
            padding: "4px 8px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            background: "white",
            color: "#1E293B",
          }}
        >
          🇮🇳 India View
        </button>
      </div>

      {/* Bottom Live Telemetry Overlay */}
      {currentTxn && (
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: 14,
            right: 14,
            zIndex: 1000,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.94)",
            backdropFilter: "blur(6px)",
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #E2E8F0",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
            fontSize: 12,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <span style={{ color: "#64748B", fontSize: 11 }}>Active Corridor:</span>{" "}
            <b>
              {currentTxn.prev_city ?? "Coimbatore"} → {currentTxn.city ?? "Coimbatore"}
            </b>{" "}
            ({currentTxn.merchant_name ?? currentTxn.terminal_id ?? "Direct"})
          </div>
          <div style={{ display: "flex", gap: 16 }}>
            <div>
              <span style={{ color: "#64748B", fontSize: 11 }}>Distance:</span>{" "}
              <b>
                {currentTxn.distance_from_prev_km != null
                  ? `${currentTxn.distance_from_prev_km.toFixed(1)} km`
                  : "0 km (Baseline)"}
              </b>
            </div>
            <div>
              <span style={{ color: "#64748B", fontSize: 11 }}>Travel Velocity:</span>{" "}
              <b
                style={{
                  color: (currentTxn.speed_kmh ?? 0) > 800 ? "#DC2626" : "inherit",
                }}
              >
                {currentTxn.speed_kmh != null ? `${currentTxn.speed_kmh.toFixed(1)} km/h` : "N/A"}
              </b>
            </div>
            <div>
              <span style={{ color: "#64748B", fontSize: 11 }}>Status:</span>{" "}
              <b
                style={{
                  color: (currentTxn.speed_kmh ?? 0) > 800 ? "#DC2626" : "#16A34A",
                }}
              >
                {(currentTxn.speed_kmh ?? 0) > 800 ? "🚨 Impossible Speed" : "✅ Plausible Transit"}
              </b>
            </div>
          </div>
        </div>
      )}

      {/* Leaflet DOM Container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Keyframe animation for pulse ring */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.6); opacity: 0.8; }
          70% { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .leaflet-popup-content-wrapper {
          border-radius: 10px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  );
};

export default TransactionMap;
