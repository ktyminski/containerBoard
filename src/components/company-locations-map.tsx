"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { MAP_STYLE_URL } from "@/components/map-shared";

type CompanyLocationMapItem = {
  addressText: string;
  postalCode?: string;
  country?: string;
  point: [number, number];
};

type CompanyLocationsMapProps = {
  locations: CompanyLocationMapItem[];
  focusedLocationIndex?: number | null;
  focusRequestId?: number;
};

function toFeatures(locations: CompanyLocationMapItem[]): GeoJSON.Feature<GeoJSON.Point>[] {
  return locations.map((location, index) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: location.point,
    },
    properties: {
      id: String(index),
      addressText: location.addressText,
      postalCode: location.postalCode ?? "",
      country: location.country ?? "",
    },
  }));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPopupHtml(input: {
  addressText: string;
  postalCode?: string;
}): string {
  const safeAddressText = escapeHtml(input.addressText);
  const safePostalCode = escapeHtml((input.postalCode ?? "").trim());

  return `<div style="font-family:sans-serif; min-width:230px; max-width:300px; padding:10px 11px;">
    <div style="font-size:13px; line-height:1.35; color:#0f172a;">
      ${safePostalCode ? `<strong>${safePostalCode}</strong> ` : ""}${safeAddressText}
    </div>
  </div>`;
}

export function CompanyLocationsMap({
  locations,
  focusedLocationIndex = null,
  focusRequestId = 0,
}: CompanyLocationsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || locations.length === 0) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: locations[0].point,
      zoom: 9,
      minZoom: 0,
      maxZoom: 18,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("company-locations", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: toFeatures(locations),
        },
      });

      map.addLayer({
        id: "company-locations-point",
        type: "circle",
        source: "company-locations",
        paint: {
          "circle-color": "#0ea5e9",
          "circle-radius": 8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.on("click", "company-locations-point", (event) => {
        const feature = event.features?.[0];
        if (!feature || !feature.geometry || feature.geometry.type !== "Point") {
          return;
        }

        const addressText = String(feature.properties?.addressText ?? "");
        const postalCode = String(feature.properties?.postalCode ?? "");
        const coordinates = feature.geometry.coordinates as [number, number];

        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({
          closeButton: true,
          className: "company-map-popup",
        })
          .setLngLat(coordinates)
          .setHTML(buildPopupHtml({ addressText, postalCode }))
          .addTo(map);
      });

      const bounds = new maplibregl.LngLatBounds();
      for (const location of locations) {
        bounds.extend(location.point);
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 50, maxZoom: 13, duration: 0 });
      }
    });

    mapRef.current = map;

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [locations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const source = map.getSource("company-locations") as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    source.setData({
      type: "FeatureCollection",
      features: toFeatures(locations),
    });
  }, [locations]);

  useEffect(() => {
    if (focusedLocationIndex === null) {
      return;
    }

    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const target = locations[focusedLocationIndex];
    if (!target) {
      return;
    }

    try {
      map.flyTo({
        center: target.point,
        zoom: Math.max(map.getZoom(), 12),
        duration: 1200,
        essential: true,
      });
    } catch {
      map.jumpTo({
        center: target.point,
        zoom: Math.max(map.getZoom(), 12),
      });
    }

    popupRef.current?.remove();
    popupRef.current = new maplibregl.Popup({
      closeButton: true,
      className: "company-map-popup",
    })
      .setLngLat(target.point)
      .setHTML(
        buildPopupHtml({
          addressText: target.addressText,
          postalCode: target.postalCode,
        }),
      )
      .addTo(map);
  }, [focusRequestId, focusedLocationIndex, locations]);

  return <div ref={containerRef} className="h-[380px] w-full rounded-xl" />;
}
