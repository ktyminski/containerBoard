"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { MAP_STYLE_URL } from "@/components/map-shared";

type CompanyLocationMapItem = {
  label: string;
  addressText: string;
  point: [number, number];
  isMain: boolean;
};

type CompanyLocationsMapProps = {
  locations: CompanyLocationMapItem[];
  labels: {
    mainLocationBadge: string;
  };
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
      label: location.label,
      addressText: location.addressText,
      isMain: location.isMain,
    },
  }));
}

function buildPopupHtml(input: {
  label: string;
  addressText: string;
  isMain: boolean;
  mainLocationBadge: string;
}): string {
  return `<div style="font-family:sans-serif; min-width:220px; padding:10px;">
    <div style="font-weight:700; color:#f8fafc;">${input.label}</div>
    <div style="font-size:12px; color:#cbd5e1; margin-top:4px;">${input.addressText}</div>
    ${input.isMain ? `<div style="font-size:12px; margin-top:6px; color:#f59e0b;">${input.mainLocationBadge}</div>` : ""}
  </div>`;
}

export function CompanyLocationsMap({
  locations,
  labels,
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
          "circle-color": [
            "case",
            ["boolean", ["get", "isMain"], false],
            "#f59e0b",
            "#0ea5e9",
          ],
          "circle-radius": [
            "case",
            ["boolean", ["get", "isMain"], false],
            10,
            7,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: "company-locations-label",
        type: "symbol",
        source: "company-locations",
        layout: {
          "text-field": ["get", "label"],
          "text-size": 12,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
        },
      });

      map.on("click", "company-locations-point", (event) => {
        const feature = event.features?.[0];
        if (!feature || !feature.geometry || feature.geometry.type !== "Point") {
          return;
        }

        const label = String(feature.properties?.label ?? "");
        const addressText = String(feature.properties?.addressText ?? "");
        const isMain = Boolean(feature.properties?.isMain);
        const coordinates = feature.geometry.coordinates as [number, number];

        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({
          closeButton: true,
          className: "company-map-popup",
        })
          .setLngLat(coordinates)
          .setHTML(buildPopupHtml({ label, addressText, isMain, mainLocationBadge: labels.mainLocationBadge }))
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
  }, [labels.mainLocationBadge, locations]);

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
          label: target.label,
          addressText: target.addressText,
          isMain: target.isMain,
          mainLocationBadge: labels.mainLocationBadge,
        }),
      )
      .addTo(map);
  }, [focusRequestId, focusedLocationIndex, labels.mainLocationBadge, locations]);

  return <div ref={containerRef} className="h-[380px] w-full rounded-xl" />;
}
