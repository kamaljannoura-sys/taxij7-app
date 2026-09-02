import React, { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import type { Driver } from "../../types";

// Sur l'app native, la carte interactive n'est pas encore disponible (elle utilise
// Leaflet, une librairie web). En attendant, on affiche la position des chauffeurs
// en liste — la carte complète fonctionne dès maintenant sur la version web.
export default function DriverMapScreen() {
  const { token } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    setDrivers(await api.getDrivers(token));
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
    socket.on("driver:location", onLocation);
    return () => {
      socket.off("driver:location", onLocation);
    };
  }, []);

  const located = drivers.filter((d) => d.driverProfile?.lat != null && d.driverProfile?.lng != null);

  return (
    <View style={styles.container}>
      <Text style={styles.notice}>
        La carte interactive est disponible sur la version web (même adresse dans un navigateur). Voici les
        positions en liste :
      </Text>
      <FlatList
        data={located}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>Aucun chauffeur localisé pour l'instant.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>
              {item.driverProfile!.lat!.toFixed(5)}, {item.driverProfile!.lng!.toFixed(5)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  notice: { fontSize: 12, color: "#666", padding: 16, backgroundColor: "#fff3e0" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10 },
  name: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 13, color: "#666", marginTop: 2 },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
});
