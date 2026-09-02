import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import type { Driver } from "../../types";

export default function NewRideScreen() {
  const { token } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.getDrivers(token).then(setDrivers).catch(() => {});
  }, [token]);

  const availableDrivers = drivers.filter((d) => d.driverProfile?.status === "AVAILABLE");

  const reset = () => {
    setClientName("");
    setClientPhone("");
    setPickupAddress("");
    setDestinationAddress("");
    setNotes("");
    setSelectedDriverId(null);
  };

  const onSubmit = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await api.createRide(token, {
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        pickupAddress: pickupAddress.trim(),
        destinationAddress: destinationAddress.trim(),
        notes: notes.trim() || undefined,
        driverId: selectedDriverId ?? undefined,
      });
      Alert.alert(
        "Course créée",
        selectedDriverId ? "La course a été envoyée au chauffeur." : "La course est en attente d'assignation."
      );
      reset();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible de créer la course");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    clientName.trim() && clientPhone.trim() && pickupAddress.trim() && destinationAddress.trim();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.label}>Nom du client</Text>
        <TextInput style={styles.input} value={clientName} onChangeText={setClientName} />

        <Text style={styles.label}>Téléphone du client</Text>
        <TextInput
          style={styles.input}
          value={clientPhone}
          onChangeText={setClientPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Adresse de prise en charge</Text>
        <TextInput style={styles.input} value={pickupAddress} onChangeText={setPickupAddress} />

        <Text style={styles.label}>Destination</Text>
        <TextInput
          style={styles.input}
          value={destinationAddress}
          onChangeText={setDestinationAddress}
        />

        <Text style={styles.label}>Notes (optionnel)</Text>
        <TextInput style={styles.input} value={notes} onChangeText={setNotes} multiline />

        <Text style={styles.label}>Assigner à un chauffeur (optionnel)</Text>
        <View style={styles.driverRow}>
          <TouchableOpacity
            style={[styles.driverChip, selectedDriverId === null && styles.driverChipSelected]}
            onPress={() => setSelectedDriverId(null)}
          >
            <Text style={selectedDriverId === null ? styles.driverChipTextSelected : styles.driverChipText}>
              Non assignée
            </Text>
          </TouchableOpacity>
          {availableDrivers.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.driverChip, selectedDriverId === d.id && styles.driverChipSelected]}
              onPress={() => setSelectedDriverId(d.id)}
            >
              <Text style={selectedDriverId === d.id ? styles.driverChipTextSelected : styles.driverChipText}>
                {d.name}
              </Text>
            </TouchableOpacity>
          ))}
          {availableDrivers.length === 0 && (
            <Text style={styles.meta}>Aucun chauffeur disponible actuellement.</Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.button, (!canSubmit || submitting) && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.buttonText}>
            {submitting ? "Création..." : "Créer la course"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  label: { fontSize: 13, fontWeight: "600", color: "#444", marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  driverRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  driverChip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  driverChipSelected: { backgroundColor: "#1a1a1a", borderColor: "#1a1a1a" },
  driverChipText: { color: "#333" },
  driverChipTextSelected: { color: "#fff" },
  meta: { fontSize: 13, color: "#999" },
  button: {
    backgroundColor: "#1a1a1a",
    borderRadius: 10,
    padding: 16,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
