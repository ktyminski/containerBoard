"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { MAP_STYLE_URL } from "@/components/map-shared";

type AnnouncementLocationMapProps = {
  point: [number, number];
  label: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function AnnouncementLocationMap({
  point,
  label,
}: AnnouncementLocationMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: point,
      zoom: 11,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => {
      new maplibregl.Marker({ color: "#0ea5e9" }).setLngLat(point).addTo(map);
      new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "company-map-popup",
      })
        .setLngLat(point)
        .setHTML(
          `<div style="font-family: sans-serif; min-width:220px; max-width:300px; padding:10px;">
            <div style="font-size:12px; font-weight:600; color:#f8fafc;">${escapeHtml(label)}</div>
          </div>`,
        )
        .addTo(map);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [point, label]);

  return <div ref={containerRef} className="h-72 w-full rounded-xl" />;
}
