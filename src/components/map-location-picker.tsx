"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MAP_STYLE_URL } from "@/components/map-shared";

const DEFAULT_CENTER: [number, number] = [21.0122, 52.2297];

type MapLocationPickerPoint = {
  id: string;
  lat: number | null;
  lng: number | null;
  isPrimary?: boolean;
};

type MapLocationPickerBaseProps = {
  labels: {
    hint: string;
  };
  mapClassName?: string;
};

type MapLocationPickerSingleProps = MapLocationPickerBaseProps & {
  lat: number | null;
  lng: number | null;
  onChange: (next: { lat: number; lng: number }) => void;
  points?: never;
  activePointId?: never;
  onPointChange?: never;
  onActivePointChange?: never;
};

type MapLocationPickerMultiProps = MapLocationPickerBaseProps & {
  points: MapLocationPickerPoint[];
  activePointId: string | null;
  onPointChange: (id: string, next: { lat: number; lng: number }) => void;
  onActivePointChange?: (id: string) => void;
  lat?: never;
  lng?: never;
  onChange?: never;
};

type MapLocationPickerProps = MapLocationPickerSingleProps | MapLocationPickerMultiProps;

function createMultiMarkerElement() {
  const markerElement = document.createElement("button");
  markerElement.type = "button";
  markerElement.style.width = "16px";
  markerElement.style.height = "16px";
  markerElement.style.borderRadius = "9999px";
  markerElement.style.borderWidth = "2px";
  markerElement.style.borderStyle = "solid";
  markerElement.style.boxShadow = "0 0 0 2px rgba(255,255,255,0.3)";
  markerElement.style.cursor = "pointer";
  markerElement.setAttribute("aria-label", "Wybierz punkt lokalizacji");
  return markerElement;
}

function applyMultiMarkerStyle(
  markerElement: HTMLElement,
  options: { active: boolean; primary: boolean },
) {
  if (options.active) {
    markerElement.style.background = "#2f639a";
    markerElement.style.borderColor = "#d7e7fb";
    markerElement.style.transform = "scale(1.12)";
  } else if (options.primary) {
    markerElement.style.background = "#16406b";
    markerElement.style.borderColor = "#9fc3eb";
    markerElement.style.transform = "scale(1)";
  } else {
    markerElement.style.background = "#6b7280";
    markerElement.style.borderColor = "#d1d5db";
    markerElement.style.transform = "scale(1)";
  }
}

export function MapLocationPicker({
  labels,
  mapClassName,
  ...modeProps
}: MapLocationPickerProps) {
  const isMultiMode = "points" in modeProps;
  const multiPoints = "points" in modeProps ? modeProps.points : null;
  const multiActivePointId = "points" in modeProps ? modeProps.activePointId : null;
  const lat = isMultiMode ? null : modeProps.lat;
  const lng = isMultiMode ? null : modeProps.lng;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const multiMarkersRef = useRef<
    Map<
      string,
      {
        marker: maplibregl.Marker;
        element: HTMLElement;
      }
    >
  >(new Map());
  const onChangeRef = useRef<((next: { lat: number; lng: number }) => void) | null>(
    isMultiMode ? null : modeProps.onChange,
  );
  const onPointChangeRef = useRef<
    ((id: string, next: { lat: number; lng: number }) => void) | null
  >(isMultiMode ? modeProps.onPointChange : null);
  const onActivePointChangeRef = useRef<((id: string) => void) | null>(
    isMultiMode ? modeProps.onActivePointChange ?? null : null,
  );
  const activePointIdRef = useRef<string | null>(isMultiMode ? modeProps.activePointId : null);
  const isMultiModeRef = useRef(isMultiMode);

  useEffect(() => {
    if ("points" in modeProps) {
      isMultiModeRef.current = true;
      onPointChangeRef.current = modeProps.onPointChange;
      onActivePointChangeRef.current = modeProps.onActivePointChange ?? null;
      activePointIdRef.current = modeProps.activePointId;
      onChangeRef.current = null;
      return;
    }

    isMultiModeRef.current = false;
    onChangeRef.current = modeProps.onChange;
    onPointChangeRef.current = null;
    onActivePointChangeRef.current = null;
    activePointIdRef.current = null;
  }, [modeProps]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }
    const multiMarkers = multiMarkersRef.current;

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

      if (isMultiModeRef.current) {
        const activePointId = activePointIdRef.current;
        if (!activePointId) {
          return;
        }
        onPointChangeRef.current?.(activePointId, { lat: nextLat, lng: nextLng });
        return;
      }

      if (!markerRef.current) {
        markerRef.current = new maplibregl.Marker({ draggable: true })
          .setLngLat([nextLng, nextLat])
          .addTo(map);
        markerRef.current.on("dragend", () => {
          const point = markerRef.current?.getLngLat();
          if (!point) {
            return;
          }
          onChangeRef.current?.({ lat: point.lat, lng: point.lng });
        });
      } else {
        markerRef.current.setLngLat([nextLng, nextLat]);
      }

      onChangeRef.current?.({ lat: nextLat, lng: nextLng });
    });

    mapRef.current = map;
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      for (const entry of multiMarkers.values()) {
        entry.marker.remove();
      }
      multiMarkers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isMultiMode) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

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
        onChangeRef.current?.({ lat: point.lat, lng: point.lng });
      });
    } else {
      markerRef.current.setLngLat([lng, lat]);
    }

    map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 12) });
  }, [isMultiMode, lat, lng]);

  useEffect(() => {
    if (!isMultiMode) {
      for (const entry of multiMarkersRef.current.values()) {
        entry.marker.remove();
      }
      multiMarkersRef.current.clear();
      return;
    }

    const map = mapRef.current;
    if (!map) {
      return;
    }

    const points = multiPoints;
    const activePointId = multiActivePointId;
    if (!points) {
      return;
    }
    const visiblePoints = points.filter(
      (point) => typeof point.lat === "number" && typeof point.lng === "number",
    );
    const visibleIds = new Set(visiblePoints.map((point) => point.id));

    for (const [id, entry] of multiMarkersRef.current.entries()) {
      if (!visibleIds.has(id)) {
        entry.marker.remove();
        multiMarkersRef.current.delete(id);
      }
    }

    for (const point of visiblePoints) {
      const existing = multiMarkersRef.current.get(point.id);
      if (!existing) {
        const element = createMultiMarkerElement();
        const marker = new maplibregl.Marker({ element, draggable: true })
          .setLngLat([point.lng as number, point.lat as number])
          .addTo(map);

        element.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          onActivePointChangeRef.current?.(point.id);
        });

        marker.on("dragend", () => {
          const coordinates = marker.getLngLat();
          onPointChangeRef.current?.(point.id, {
            lat: coordinates.lat,
            lng: coordinates.lng,
          });
        });

        multiMarkersRef.current.set(point.id, { marker, element });
      } else {
        existing.marker.setLngLat([point.lng as number, point.lat as number]);
      }
    }

    for (const point of visiblePoints) {
      const entry = multiMarkersRef.current.get(point.id);
      if (!entry) {
        continue;
      }
      applyMultiMarkerStyle(entry.element, {
        active: point.id === activePointId,
        primary: point.isPrimary === true,
      });
    }

    const activePoint = visiblePoints.find((point) => point.id === activePointId) ?? null;
    if (activePoint) {
      map.easeTo({
        center: [activePoint.lng as number, activePoint.lat as number],
        zoom: Math.max(map.getZoom(), 11),
      });
      return;
    }

    if (visiblePoints.length === 1) {
      const onlyPoint = visiblePoints[0];
      map.easeTo({
        center: [onlyPoint.lng as number, onlyPoint.lat as number],
        zoom: Math.max(map.getZoom(), 11),
      });
      return;
    }

    if (visiblePoints.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      for (const point of visiblePoints) {
        bounds.extend([point.lng as number, point.lat as number]);
      }
      map.fitBounds(bounds, {
        padding: 40,
        maxZoom: 12,
        duration: 400,
      });
    }
  }, [isMultiMode, multiActivePointId, multiPoints]);

  return (
    <div className="grid gap-2">
      <div
        ref={mapContainerRef}
        className={`w-full overflow-hidden rounded-md border border-neutral-700 ${mapClassName ?? "h-56"}`}
      />
      {labels.hint ? <p className="text-xs text-neutral-300">{labels.hint}</p> : null}
    </div>
  );
}
