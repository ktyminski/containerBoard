"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MAP_STYLE_URL } from "@/components/map-shared";
import type { AppLocale, AppMessages } from "@/lib/i18n";
import type { GeocodeAddressParts } from "@/lib/geocode-address";

type BranchLocationPickerProps = {
  locale: AppLocale;
  messages: AppMessages["companyCreate"];
  lat: string;
  lng: string;
  isVisible: boolean;
  onChange: (next: {
    lat: string;
    lng: string;
    addressText?: string;
    addressParts?: GeocodeAddressParts | null;
  }) => void;
  onStatusChange?: (status: string | null) => void;
};

type ReverseGeocodeResponse = {
  item: {
    label: string;
    shortLabel?: string;
    addressParts?: GeocodeAddressParts | null;
  } | null;
  error?: string;
};

const DEFAULT_CENTER: [number, number] = [21.0122, 52.2297];

function toNumber(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function BranchLocationPicker({
  locale,
  messages,
  lat,
  lng,
  isVisible,
  onChange,
  onStatusChange,
}: BranchLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const updateFromCoordinates = useCallback(
    async (nextLat: number, nextLng: number) => {
      const nextLatText = nextLat.toFixed(6);
      const nextLngText = nextLng.toFixed(6);
      onChangeRef.current({
        lat: nextLatText,
        lng: nextLngText,
        addressParts: null,
      });

      try {
        const response = await fetch(
          `/api/geocode/reverse?lat=${encodeURIComponent(nextLatText)}&lng=${encodeURIComponent(nextLngText)}&lang=${locale}`,
        );
        const data = (await response.json()) as ReverseGeocodeResponse;
        if (!response.ok || data.error || !data.item?.label) {
          return;
        }

        onChangeRef.current({
          lat: nextLatText,
          lng: nextLngText,
          addressText: data.item.label,
          addressParts: data.item.addressParts ?? null,
        });
      } catch {
        // ignore reverse lookup errors, coordinates are already set
      }
    },
    [locale],
  );

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
          void updateFromCoordinates(point.lat, point.lng);
        });
      } else {
        markerRef.current.setLngLat([nextLng, nextLat]);
      }

      void updateFromCoordinates(nextLat, nextLng);
      onStatusChangeRef.current?.(messages.branchLocationManualSet);
    });

    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [messages.branchLocationManualSet, updateFromCoordinates]);

  useEffect(() => {
    const map = mapRef.current;
    const latNum = toNumber(lat);
    const lngNum = toNumber(lng);
    if (!map || latNum === null || lngNum === null) {
      return;
    }

    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ draggable: true })
        .setLngLat([lngNum, latNum])
        .addTo(map);

      markerRef.current.on("dragend", () => {
        const point = markerRef.current?.getLngLat();
        if (!point) {
          return;
        }
        void updateFromCoordinates(point.lat, point.lng);
      });
    } else {
      markerRef.current.setLngLat([lngNum, latNum]);
    }

    map.easeTo({ center: [lngNum, latNum], zoom: Math.max(map.getZoom(), 12) });
  }, [lat, lng, updateFromCoordinates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isVisible) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      map.resize();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isVisible]);

  return (
    <div className="grid gap-2">
      <p className="text-center text-xs text-neutral-300">{messages.branchLocationHint}</p>

      <div
        ref={mapContainerRef}
        className="h-56 w-full overflow-hidden rounded-md border border-neutral-700/80"
      />
    </div>
  );
}

