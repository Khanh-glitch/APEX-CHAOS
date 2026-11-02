"use client";
import dynamic from "next/dynamic";

const MapLabApp = dynamic(() => import("@/maplab/ui/MapLabApp"), {
  ssr: false,
  loading: () => <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "#0e1a28", color: "#dbe6f1", font: "16px Segoe UI, sans-serif" }}>Đang tải Map Lab Studio…</div>,
});

export default function MapLabClient() {
  return <MapLabApp />;
}
