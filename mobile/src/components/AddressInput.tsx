import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { searchAddress, type AddressSuggestion } from "../lib/geocode";

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export default function AddressInput({ value, onChangeText, placeholder }: Props) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const justPicked = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchAddress(value);
      setSuggestions(res);
      setOpen(res.length > 0);
      setLoading(false);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  const pick = (s: AddressSuggestion) => {
    justPicked.current = true;
    onChangeText(s.label);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" style={styles.spinner} />}
      </View>
      {open && (
        <View style={styles.dropdown}>
          {suggestions.map((s, i) => (
            <TouchableOpacity key={`${s.label}-${i}`} style={styles.item} onPress={() => pick(s)}>
              <Text style={styles.itemText}>📍 {s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative", zIndex: 10 },
  inputRow: { justifyContent: "center" },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  spinner: { position: "absolute", right: 12 },
  dropdown: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  item: { paddingVertical: 12, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: "#f0f0f0" },
  itemText: { fontSize: 14, color: "#333" },
});
