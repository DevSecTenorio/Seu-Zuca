"use client";

import { useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { adjustAddressCoordinatesAction } from "@/server/actions/address-actions";

// Leaflet's default marker image paths assume a plain <img src> setup, which breaks under
// Next.js's bundler — a simple colored DivIcon avoids the whole asset-path workaround.
const PIN_ICON = L.divIcon({
  className: "",
  html: '<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;background:#dc2626;border:2px solid white;transform:rotate(-45deg);box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 20],
});

function DraggableMarker({
  position,
  onMove,
}: {
  position: [number, number];
  onMove: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onMove(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <Marker
      position={position}
      icon={PIN_ICON}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target as L.Marker;
          const { lat, lng } = marker.getLatLng();
          onMove(lat, lng);
        },
      }}
    />
  );
}

/** Lets the buyer/fornecedor fine-tune a geocoded address pin (SPEC.md §10, LOG-03) — dragging or
 * clicking moves the marker, and the adjusted point is saved to the address once the buyer
 * confirms, superseding the geocoded one for every future order at that address. */
export function AddressMap({ addressId, initialLat, initialLng }: { addressId: string; initialLat: number; initialLng: number }) {
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  async function handleSave() {
    setSaveState("saving");
    await adjustAddressCoordinatesAction(addressId, position[0], position[1]);
    setSaveState("saved");
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Arraste o marcador (ou clique no mapa) para ajustar o ponto exato do endereço. Isso melhora o cálculo de frete por
        distância.
      </p>
      <div className="h-64 w-full overflow-hidden rounded-md border">
        <MapContainer center={position} zoom={16} scrollWheelZoom={false} className="size-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DraggableMarker position={position} onMove={(lat, lng) => setPosition([lat, lng])} />
        </MapContainer>
      </div>
      <div className="flex items-center gap-3">
        <Button type="button" size="sm" onClick={handleSave} disabled={saveState === "saving"}>
          {saveState === "saving" ? "Salvando..." : "Confirmar posição"}
        </Button>
        {saveState === "saved" && <span className="text-xs text-success-foreground">Posição salva.</span>}
      </div>
    </div>
  );
}
