import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import type { DriverStackParamList } from "../../navigation/types";
import type { Ride, RideStatus } from "../../types";

const STATUS_LABEL: Record<RideStatus, string> = {
  PENDING: "En attente",
  ASSIGNED: "Nouvelle course",
  ACCEPTED: "Acceptée",
  EN_ROUTE: "En route",
  ARRIVED: "Arrivé",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
};

export default function DriverHomeScreen() {
  const { user, token, setUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  const [available, setAvailable] = useState(user?.driverProfile?.status === "AVAILABLE");
  const [rides, setRides] = useState<Ride[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const data = await api.getMyRides(token);
    setRides(data);
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const upsertRide = useCallback((ride: Ride) => {
    setRides((prev) => {
      const stillMine = ["ASSIGNED", "ACCEPTED", "EN_ROUTE", "ARRIVED"].includes(ride.status);
      const exists = prev.some((r) => r.id === ride.id);
      if (!stillMine) return prev.filter((r) => r.id !== ride.id);
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

  useEffect(() => {
    let cancelled = false;

    async function startWatching() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Position refusée : le dispatcher ne vous verra pas sur la carte.");
        return;
      }
      setLocationError(null);
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 30 },
        (position) => {
          if (cancelled) return;
          getSocket()?.emit("driver:location", {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        }
      );
    }

    if (available) {
      startWatching();
    }

    return () => {
      cancelled = true;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [available]);

  const toggleAvailable = async (value: boolean) => {
    if (!token || !user) return;
    setAvailable(value);
    try {
      const status = value ? "AVAILABLE" : "UNAVAILABLE";
      await api.updateMyStatus(token, status);
      if (user.driverProfile) {
        setUser({ ...user, driverProfile: { ...user.driverProfile, status } });
      }
    } catch {
      setAvailable(!value);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <View>
          <Text style={styles.toggleLabel}>{available ? "Disponible" : "Indisponible"}</Text>
          <Text style={styles.toggleMeta}>
            {available ? "Vous pouvez recevoir des courses" : "Vous ne recevrez pas de courses"}
          </Text>
        </View>
        <Switch value={available} onValueChange={toggleAvailable} />
      </View>

      {locationError && <Text style={styles.locationError}>{locationError}</Text>}

      <FlatList
        data={rides}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={<Text style={styles.empty}>Aucune course en cours.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate("RideDetail", { rideId: item.id, ride: item })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.client}>{item.clientName}</Text>
              <Text style={styles.status}>{STATUS_LABEL[item.status]}</Text>
            </View>
            <Text style={styles.meta}>📍 {item.pickupAddress}</Text>
            <Text style={styles.meta}>🎯 {item.destinationAddress}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  toggleLabel: { fontSize: 17, fontWeight: "700" },
  toggleMeta: { fontSize: 12, color: "#666", marginTop: 2 },
  locationError: {
    fontSize: 12,
    color: "#ef6c00",
    backgroundColor: "#fff3e0",
    padding: 10,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
  },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  client: { fontSize: 16, fontWeight: "600" },
  status: { fontSize: 12, fontWeight: "600", color: "#1565c0" },
  meta: { fontSize: 13, color: "#666", marginTop: 2 },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
});
