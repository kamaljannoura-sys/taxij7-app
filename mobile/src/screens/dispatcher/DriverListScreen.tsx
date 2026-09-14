import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { callPhone, messagePhone } from "../../lib/contact";
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
  const [formVisible, setFormVisible] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [plate, setPlate] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const resetForm = () => {
    setName("");
    setPhone("");
    setPassword("");
    setVehicle("");
    setPlate("");
  };

  const submitDriver = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const driver = await api.createDriver(token, {
        name: name.trim(),
        phone: phone.trim(),
        password: password.trim(),
        vehicle: vehicle.trim() || undefined,
        plate: plate.trim() || undefined,
      });
      setDrivers((prev) => [...prev, driver].sort((a, b) => a.name.localeCompare(b.name)));
      resetForm();
      setFormVisible(false);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible de créer le chauffeur");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = name.trim() && phone.trim() && password.trim().length >= 4;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addButton} onPress={() => setFormVisible(true)}>
        <Text style={styles.addButtonText}>+ Ajouter un chauffeur</Text>
      </TouchableOpacity>

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
                  onPress={() => callPhone(item.phone)}
                >
                  <Text style={styles.actionText}>📞 Appeler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => messagePhone(item.phone)}
                >
                  <Text style={styles.actionText}>💬 Message</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />

      <Modal
        visible={formVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFormVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={{ width: "100%" }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView style={styles.modalCard} contentContainerStyle={{ padding: 20 }}>
              <Text style={styles.modalTitle}>Ajouter un chauffeur</Text>

              <Text style={styles.formLabel}>Nom</Text>
              <TextInput style={styles.formInput} value={name} onChangeText={setName} />

              <Text style={styles.formLabel}>Téléphone</Text>
              <TextInput
                style={styles.formInput}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <Text style={styles.formLabel}>Mot de passe (4 caractères min.)</Text>
              <TextInput
                style={styles.formInput}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />

              <Text style={styles.formLabel}>Véhicule (optionnel)</Text>
              <TextInput style={styles.formInput} value={vehicle} onChangeText={setVehicle} />

              <Text style={styles.formLabel}>Plaque (optionnel)</Text>
              <TextInput style={styles.formInput} value={plate} onChangeText={setPlate} />

              <TouchableOpacity
                style={[styles.submitButton, (!canSubmit || submitting) && styles.submitButtonDisabled]}
                onPress={submitDriver}
                disabled={!canSubmit || submitting}
              >
                <Text style={styles.submitButtonText}>
                  {submitting ? "Création..." : "Créer le compte"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  resetForm();
                  setFormVisible(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  addButton: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  addButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "85%",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  formLabel: { fontSize: 13, fontWeight: "600", color: "#444", marginTop: 14, marginBottom: 6 },
  formInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  submitButton: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
  },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cancelButton: { padding: 14, alignItems: "center", marginTop: 4, marginBottom: 8 },
  cancelButtonText: { color: "#c62828", fontSize: 15, fontWeight: "600" },
});
