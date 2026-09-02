import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { getSocket } from "../../lib/socket";
import type { DriverStackParamList } from "../../navigation/types";
import type { Ride, RideStatus } from "../../types";

type Props = NativeStackScreenProps<DriverStackParamList, "RideDetail">;

const NEXT_STATUS: Partial<Record<RideStatus, { next: RideStatus; label: string }>> = {
  ACCEPTED: { next: "EN_ROUTE", label: "Démarrer la course (en route)" },
  EN_ROUTE: { next: "ARRIVED", label: "Je suis arrivé" },
  ARRIVED: { next: "COMPLETED", label: "Terminer la course" },
};

export default function RideDetailScreen({ route, navigation }: Props) {
  const { token } = useAuth();
  const [ride, setRide] = useState<Ride | undefined>(route.params.ride);
  const [busy, setBusy] = useState(false);
  const rideId = route.params.rideId;

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onUpdate = (updated: Ride) => {
      if (updated.id === rideId) setRide(updated);
    };
    socket.on("ride:new", onUpdate);
    socket.on("ride:updated", onUpdate);
    return () => {
      socket.off("ride:new", onUpdate);
      socket.off("ride:updated", onUpdate);
    };
  }, [rideId]);

  if (!ride) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Course introuvable.</Text>
      </View>
    );
  }

  const run = async (action: () => Promise<Ride>) => {
    setBusy(true);
    try {
      const updated = await action();
      setRide(updated);
      if (updated.status === "PENDING" || updated.status === "COMPLETED") {
        navigation.goBack();
      }
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Action impossible");
    } finally {
      setBusy(false);
    }
  };

  const callClient = () => Linking.openURL(`tel:${ride.clientPhone}`);

  const nextAction = NEXT_STATUS[ride.status];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.section}>Client</Text>
      <Text style={styles.value}>{ride.clientName}</Text>
      <TouchableOpacity onPress={callClient}>
        <Text style={styles.link}>{ride.clientPhone}</Text>
      </TouchableOpacity>

      <Text style={styles.section}>Prise en charge</Text>
      <Text style={styles.value}>{ride.pickupAddress}</Text>

      <Text style={styles.section}>Destination</Text>
      <Text style={styles.value}>{ride.destinationAddress}</Text>

      {ride.notes ? (
        <>
          <Text style={styles.section}>Notes</Text>
          <Text style={styles.value}>{ride.notes}</Text>
        </>
      ) : null}

      <View style={{ marginTop: 24 }}>
        {ride.status === "ASSIGNED" && (
          <>
            <TouchableOpacity
              style={styles.acceptButton}
              disabled={busy}
              onPress={() => token && run(() => api.acceptRide(token, ride.id))}
            >
              <Text style={styles.buttonText}>Accepter la course</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineButton}
              disabled={busy}
              onPress={() => token && run(() => api.declineRide(token, ride.id))}
            >
              <Text style={styles.declineButtonText}>Refuser</Text>
            </TouchableOpacity>
          </>
        )}

        {nextAction && (
          <TouchableOpacity
            style={styles.acceptButton}
            disabled={busy}
            onPress={() => token && run(() => api.updateRideStatus(token, ride.id, nextAction.next))}
          >
            <Text style={styles.buttonText}>{nextAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  section: { fontSize: 12, fontWeight: "700", color: "#999", marginTop: 16, textTransform: "uppercase" },
  value: { fontSize: 17, marginTop: 4 },
  link: { fontSize: 17, marginTop: 4, color: "#1565c0" },
  empty: { textAlign: "center", color: "#999", marginTop: 40 },
  acceptButton: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  declineButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#c62828",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  declineButtonText: { color: "#c62828", fontSize: 16, fontWeight: "600" },
});
