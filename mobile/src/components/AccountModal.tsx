import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";

export default function AccountModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmedName = name.trim();
    const trimmedPassword = password.trim();
    if (!trimmedName && !trimmedPassword) {
      onClose();
      return;
    }
    setSubmitting(true);
    try {
      await updateProfile({
        name: trimmedName && trimmedName !== user?.name ? trimmedName : undefined,
        password: trimmedPassword || undefined,
      });
      setPassword("");
      Alert.alert("Compte mis à jour");
      onClose();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible de mettre à jour le compte");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={{ width: "100%" }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.card}>
            <Text style={styles.title}>Mon compte</Text>

            <Text style={styles.label}>Nom</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />

            <Text style={styles.label}>Nouveau mot de passe (laisser vide pour ne pas changer)</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="4 caractères min."
            />

            <TouchableOpacity style={styles.submitButton} onPress={submit} disabled={submitting}>
              <Text style={styles.submitButtonText}>
                {submitting ? "Enregistrement..." : "Enregistrer"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  card: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  label: { fontSize: 13, fontWeight: "600", color: "#444", marginTop: 14, marginBottom: 6 },
  input: {
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
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  cancelButton: { padding: 14, alignItems: "center", marginTop: 4 },
  cancelButtonText: { color: "#c62828", fontSize: 15, fontWeight: "600" },
});
