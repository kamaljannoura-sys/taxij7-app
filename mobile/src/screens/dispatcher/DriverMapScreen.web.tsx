import "leaflet/dist/leaflet.css";
import L from "leaflet";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import type { Driver, DriverStatus } from "../../types";

const DEFAULT_CENTER: [number, number] = [45.5019, -73.5674]; // Montréal

function markerIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export default function DriverMapScreen() {
  const { token } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    const data = await api.getDrivers(token);
    setDrivers(data);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onLocation = ({ driverId, lat, lng }: { driverId: string; lat: number; lng: number }) => {
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === driverId && d.driverProfile ? { ...d, driverProfile: { ...d.driverProfile, lat, lng } } : d
        )
      );
    };
    const onStatus = ({ driverId, status }: { driverId: string; status: DriverStatus }) => {
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === driverId && d.driverProfile ? { ...d, driverProfile: { ...d.driverProfile, status } } : d
        )
      );
    };
    socket.on("driver:location", onLocation);
    socket.on("driver:status", onStatus);
    return () => {
      socket.off("driver:location", onLocation);
      socket.off("driver:status", onStatus);
    };
  }, []);

  const located = drivers.filter(
    (d) => d.driverProfile?.lat != null && d.driverProfile?.lng != null
  );

  const center: [number, number] =
    located.length > 0
      ? [located[0].driverProfile!.lat as number, located[0].driverProfile!.lng as number]
      : DEFAULT_CENTER;

  return (
    <View style={styles.container}>
      <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {located.map((d) => {
          const status = d.driverProfile!.status;
          const color = status === "AVAILABLE" ? "#2e7d32" : status === "ON_RIDE" ? "#ef6c00" : "#9e9e9e";
          return (
            <Marker
              key={d.id}
              position={[d.driverProfile!.lat as number, d.driverProfile!.lng as number]}
              icon={markerIcon(color)}
            >
              <Popup>
                <strong>{d.name}</strong>
                <br />
                {status === "AVAILABLE" ? "Disponible" : status === "ON_RIDE" ? "En course" : "Indisponible"}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      {located.length === 0 && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyText}>
            Aucun chauffeur localisé pour l'instant. La carte se met à jour dès qu'un chauffeur passe disponible.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyOverlay: {
    position: "absolute",
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 10,
    padding: 14,
  },
  emptyText: { fontSize: 13, color: "#555", textAlign: "center" },
});
