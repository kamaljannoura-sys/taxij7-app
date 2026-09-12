import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import type { Driver, Ride, RideStatus } from "../../types";

const STATUS_LABEL: Record<RideStatus, string> = {
  PENDING: "En attente",
  ASSIGNED: "Assignée",
  ACCEPTED: "Acceptée",
  EN_ROUTE: "En route",
  ARRIVED: "Arrivé",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
};

const STATUS_COLOR: Record<RideStatus, string> = {
  PENDING: "#9e9e9e",
  ASSIGNED: "#1565c0",
  ACCEPTED: "#00838f",
  EN_ROUTE: "#ef6c00",
  ARRIVED: "#6a1b9a",
  COMPLETED: "#2e7d32",
  CANCELLED: "#c62828",
};

export default function RideHistoryScreen() {
  const { token } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningRide, setAssigningRide] = useState<Ride | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const [rideData, driverData] = await Promise.all([
      api.getRides(token),
      api.getDrivers(token),
    ]);
    setRides(rideData);
    setDrivers(driverData);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const upsertRide = useCallback((ride: Ride) => {
    setRides((prev) => {
      const exists = prev.some((r) => r.id === ride.id);
      return exists ? prev.map((r) => (r.id === ride.id ? ride : r)) : [ride, ...prev];
    });
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on("ride:new", upsertRide);
    socket.on("ride:updated", upsertRide);
    return () => {
      socket.off("ride:new", upsertRide);
      socket.off("ride:updated", upsertRide);
    };
  }, [upsertRide]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const assign = (ride: Ride) => {
    const available = drivers.filter((d) => d.driverProfile?.status === "AVAILABLE");
    if (available.length === 0) {
      Alert.alert("Aucun chauffeur disponible");
      return;
    }
    setAssigningRide(ride);
  };

  const confirmAssign = async (driverId: string) => {
    if (!token || !assigningRide) return;
    const ride = assigningRide;
    setAssigningRide(null);
    try {
      const updated = await api.assignRide(token, ride.id, driverId);
      upsertRide(updated);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Échec de l'assignation");
    }
  };

  const availableDrivers = drivers.filter((d) => d.driverProfile?.status === "AVAILABLE");

  return (
    <View style={styles.container}>
      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>Aucune course pour le moment.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.client}>{item.clientName}</Text>
              <View style={[styles.badge, { backgroundColor: STATUS_COLOR[item.status] }]}>
                <Text style={styles.badgeText}>{STATUS_LABEL[item.status]}</Text>
              </View>
            </View>
            <Text style={styles.meta}>📍 {item.pickupAddress}</Text>
            <Text style={styles.meta}>🎯 {item.destinationAddress}</Text>
            {item.driver && <Text style={styles.meta}>🚕 {item.driver.name}</Text>}
            {item.status === "PENDING" && (
              <TouchableOpacity style={styles.assignButton} onPress={() => assign(item)}>
                <Text style={styles.assignButtonText}>Assigner un chauffeur</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      <Modal
        visible={assigningRide !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAssigningRide(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAssigningRide(null)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Assigner à</Text>
            {availableDrivers.map((d) => (
              <TouchableOpacity
                key={d.id}
                style={styles.modalOption}
                onPress={() => confirmAssign(d.id)}
              >
                <Text style={styles.modalOptionText}>{d.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setAssigningRide(null)}
            >
              <Text style={styles.modalCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  client: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 13, color: "#666", marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  assignButton: {
    marginTop: 10,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  assignButtonText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  modalOption: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  modalOptionText: { fontSize: 15 },
  modalCancel: { paddingVertical: 14, marginTop: 4 },
  modalCancelText: { fontSize: 15, color: "#c62828", fontWeight: "600" },
});
