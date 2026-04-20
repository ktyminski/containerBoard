"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { MAP_STYLE_URL } from "@/components/map-shared";
import type { ContainerModuleMessages } from "@/components/container-modules-i18n";

export type ContainerDetailsLocationPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
};

type ContainerDetailsLocationsMapProps = {
  points: ContainerDetailsLocationPoint[];
  freeTransportDistanceKm?: number | null;
  messages: ContainerModuleMessages["shared"];
};

const TRANSPORT_RADIUS_SOURCE_ID = "container-details-transport-radius";
const TRANSPORT_RADIUS_FILL_LAYER_ID = "container-details-transport-radius-fill";
const TRANSPORT_RADIUS_STROKE_LAYER_ID = "container-details-transport-radius-stroke";
const EARTH_RADIUS_KM = 6371.0088;

type CircleFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: {
      id: string;
    };
    geometry: {
      type: "Polygon";
      coordinates: [Array<[number, number]>];
    };
  }>;
};

function createMarkerElement(): HTMLSpanElement {
  const marker = document.createElement("span");
  marker.className =
    "block h-3.5 w-3.5 rounded-full border-2 border-white bg-sky-500 shadow-[0_1px_6px_rgba(15,23,42,0.35)]";
  return marker;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number): number {
  return (value * 180) / Math.PI;
}

function buildCircleRing(input: {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  segments?: number;
}): Array<[number, number]> {
  const segmentCount = Math.max(24, Math.trunc(input.segments ?? 56));
  const angularDistance = input.radiusKm / EARTH_RADIUS_KM;
  const latRad = toRadians(input.centerLat);
  const lngRad = toRadians(input.centerLng);
  const ring: Array<[number, number]> = [];

  for (let index = 0; index <= segmentCount; index += 1) {
    const bearing = (index / segmentCount) * Math.PI * 2;
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinAngularDistance = Math.sin(angularDistance);
    const cosAngularDistance = Math.cos(angularDistance);
    const sinBearing = Math.sin(bearing);
    const cosBearing = Math.cos(bearing);

    const lat2 = Math.asin(
      sinLat * cosAngularDistance +
        cosLat * sinAngularDistance * cosBearing,
    );
    const lng2 =
      lngRad +
      Math.atan2(
        sinBearing * sinAngularDistance * cosLat,
        cosAngularDistance - sinLat * Math.sin(lat2),
      );

    ring.push([toDegrees(lng2), toDegrees(lat2)]);
  }

  return ring;
}

function buildTransportRadiusFeatureCollection(
  points: ContainerDetailsLocationPoint[],
  radiusKm: number | null,
): CircleFeatureCollection {
  if (typeof radiusKm !== "number" || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    return {
      type: "FeatureCollection",
      features: [],
    };
  }

  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      properties: { id: point.id },
      geometry: {
        type: "Polygon",
        coordinates: [
          buildCircleRing({
            centerLat: point.lat,
            centerLng: point.lng,
            radiusKm,
          }),
        ],
      },
    })),
  };
}

function fitMapToPoints(
  map: maplibregl.Map,
  points: ContainerDetailsLocationPoint[],
  freeTransportDistanceKm: number | null,
): void {
  if (points.length === 0) {
    return;
  }

  const hasRadius =
    typeof freeTransportDistanceKm === "number" &&
    Number.isFinite(freeTransportDistanceKm) &&
    freeTransportDistanceKm > 0;

  if (points.length === 1 && !hasRadius) {
    map.easeTo({
      center: [points[0].lng, points[0].lat],
      zoom: 9,
      duration: 350,
    });
    return;
  }

  const bounds = new maplibregl.LngLatBounds();
  for (const point of points) {
    if (hasRadius) {
      const ring = buildCircleRing({
        centerLat: point.lat,
        centerLng: point.lng,
        radiusKm: freeTransportDistanceKm,
        segments: 24,
      });
      for (const [lng, lat] of ring) {
        bounds.extend([lng, lat]);
      }
    } else {
      bounds.extend([point.lng, point.lat]);
    }
  }
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, {
      padding: 44,
      maxZoom: hasRadius ? 8 : 9,
      duration: 380,
    });
  }
}

export function ContainerDetailsLocationsMap({
  points,
  freeTransportDistanceKm = null,
  messages,
}: ContainerDetailsLocationsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [isMapReady, setIsMapReady] = useState(false);

  const validPoints = useMemo(
    () =>
      points.filter(
        (point) =>
          Number.isFinite(point.lat) &&
          Number.isFinite(point.lng) &&
          point.lat >= -90 &&
          point.lat <= 90 &&
          point.lng >= -180 &&
          point.lng <= 180,
      ),
    [points],
  );

  useEffect(() => {
    if (!mapContainerRef.current || validPoints.length === 0) {
      return;
    }

    const initialPoint = validPoints[0];
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE_URL,
      center: [initialPoint.lng, initialPoint.lat],
      zoom: 6.5,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const handleLoad = () => {
      if (!map.getSource(TRANSPORT_RADIUS_SOURCE_ID)) {
        map.addSource(TRANSPORT_RADIUS_SOURCE_ID, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          } as CircleFeatureCollection,
        });
      }
      if (!map.getLayer(TRANSPORT_RADIUS_FILL_LAYER_ID)) {
        map.addLayer({
          id: TRANSPORT_RADIUS_FILL_LAYER_ID,
          type: "fill",
          source: TRANSPORT_RADIUS_SOURCE_ID,
          paint: {
            "fill-color": "#38bdf8",
            "fill-opacity": 0.14,
          },
        });
      }
      if (!map.getLayer(TRANSPORT_RADIUS_STROKE_LAYER_ID)) {
        map.addLayer({
          id: TRANSPORT_RADIUS_STROKE_LAYER_ID,
          type: "line",
          source: TRANSPORT_RADIUS_SOURCE_ID,
          paint: {
            "line-color": "#0284c7",
            "line-width": 1.5,
            "line-opacity": 0.55,
          },
        });
      }
      setIsMapReady(true);
    };

    const handleError = () => {
      setIsMapReady(true);
    };

    map.on("load", handleLoad);
    map.on("error", handleError);

    return () => {
      for (const marker of markersRef.current) {
        marker.remove();
      }
      markersRef.current = [];
      map.off("load", handleLoad);
      map.off("error", handleError);
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, [validPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) {
      return;
    }

    for (const marker of markersRef.current) {
      marker.remove();
    }
    markersRef.current = [];

    const transportRadiusSource = map.getSource(
      TRANSPORT_RADIUS_SOURCE_ID,
    ) as GeoJSONSource | undefined;
    transportRadiusSource?.setData(
      buildTransportRadiusFeatureCollection(validPoints, freeTransportDistanceKm),
    );

    for (const point of validPoints) {
      const marker = new maplibregl.Marker({
        element: createMarkerElement(),
      })
        .setLngLat([point.lng, point.lat])
        .setPopup(
          new maplibregl.Popup({
            closeButton: false,
            closeOnClick: true,
            offset: 12,
            className: "company-map-popup",
          }).setText(point.label),
        )
        .addTo(map);
      markersRef.current.push(marker);
    }

    fitMapToPoints(map, validPoints, freeTransportDistanceKm);
    const frame = window.requestAnimationFrame(() => map.resize());
    return () => window.cancelAnimationFrame(frame);
  }, [freeTransportDistanceKm, isMapReady, validPoints]);

  if (validPoints.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-sm text-neutral-600">
        {messages.mapEmpty}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-neutral-100">
      <div ref={mapContainerRef} className="h-full w-full" />
      {!isMapReady ? (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100/95">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"
            />
            {messages.mapLoading}
          </div>
        </div>
      ) : null}
    </div>
  );
}
