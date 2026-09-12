import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import type { Driver, DriverStatus } from "../../types";

const STATUS_LABEL: Record<DriverStatus, string> = {
  AVAILABLE: "Disponible",
  UNAVAILABLE: "Indisponible",
  ON_RIDE: "En course",
};

const STATUS_COLOR: Record<DriverStatus, string> = {
  AVAILABLE: "#2e7d32",
  UNAVAILABLE: "#9e9e9e",
  ON_RIDE: "#ef6c00",
};

export default function DriverListScreen() {
  const { token } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
    const onStatus = ({ driverId, status }: { driverId: string; status: DriverStatus }) => {
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === driverId && d.driverProfile
            ? { ...d, driverProfile: { ...d.driverProfile, status } }
            : d
        )
      );
    };
    socket.on("driver:status", onStatus);
    return () => {
      socket.off("driver:status", onStatus);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={drivers}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>Aucun chauffeur pour le moment.</Text>}
        renderItem={({ item }) => {
          const status = item.driverProfile?.status ?? "UNAVAILABLE";
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{item.phone}</Text>
                  {item.driverProfile?.vehicle && (
                    <Text style={styles.meta}>
                      {item.driverProfile.vehicle} · {item.driverProfile.plate}
                    </Text>
                  )}
                  <Text style={styles.meta}>
                    🏁 {item.completedRides} course{item.completedRides > 1 ? "s" : ""} terminée
                    {item.completedRides > 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: STATUS_COLOR[status] }]}>
                  <Text style={styles.badgeText}>{STATUS_LABEL[status]}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => Linking.openURL(`tel:${item.phone}`)}
                >
                  <Text style={styles.actionText}>📞 Appeler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => Linking.openURL(`sms:${item.phone}`)}
                >
                  <Text style={styles.actionText}>💬 Message</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 13, color: "#666", marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionText: { fontSize: 13, fontWeight: "600", color: "#333" },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
});
