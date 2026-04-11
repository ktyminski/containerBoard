"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MAP_STYLE_URL } from "@/components/map-shared";

const DEFAULT_CENTER: [number, number] = [21.0122, 52.2297];

export function MapLocationPicker({
  lat,
  lng,
  labels,
  mapClassName,
  onChange,
}: {
  lat: number | null;
  lng: number | null;
  labels: {
    hint: string;
  };
  mapClassName?: string;
  onChange: (next: { lat: number; lng: number }) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: 10,
      minZoom: 3,
      maxZoom: 18,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("click", (event) => {
      const nextLng = event.lngLat.lng;
      const nextLat = event.lngLat.lat;

      if (!markerRef.current) {
        markerRef.current = new maplibregl.Marker({ draggable: true })
          .setLngLat([nextLng, nextLat])
          .addTo(map);
        markerRef.current.on("dragend", () => {
          const point = markerRef.current?.getLngLat();
          if (!point) {
            return;
          }
          onChangeRef.current({ lat: point.lat, lng: point.lng });
        });
      } else {
        markerRef.current.setLngLat([nextLng, nextLat]);
      }

      onChangeRef.current({ lat: nextLat, lng: nextLng });
    });

    mapRef.current = map;
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    if (lat === null || lng === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ draggable: true })
        .setLngLat([lng, lat])
        .addTo(map);
      markerRef.current.on("dragend", () => {
        const point = markerRef.current?.getLngLat();
        if (!point) {
          return;
        }
        onChangeRef.current({ lat: point.lat, lng: point.lng });
      });
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }

    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 12) });
  }, [lat, lng]);

  return (
    <div className="grid gap-2">
      <div
        ref={mapContainerRef}
        className={`w-full overflow-hidden rounded-md border border-slate-700 ${mapClassName ?? "h-56"}`}
      />
      {labels.hint ? <p className="text-xs text-slate-300">{labels.hint}</p> : null}
    </div>
  );
}
