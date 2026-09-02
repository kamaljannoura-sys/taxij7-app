import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// expo-secure-store n'a pas d'implémentation web ; on utilise localStorage sur le web
// (utile pour la prévisualisation navigateur), et le stockage sécurisé natif sur iOS/Android.
export const storage = {
  getItem: (key: string): Promise<string | null> => {
    if (Platform.OS === "web") {
      return Promise.resolve(globalThis.localStorage?.getItem(key) ?? null);
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string): Promise<void> => {
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(key, value);
      return Promise.resolve();
    }
    return SecureStore.setItemAsync(key, value);
  },
  deleteItem: (key: string): Promise<void> => {
    if (Platform.OS === "web") {
      globalThis.localStorage?.removeItem(key);
      return Promise.resolve();
    }
    return SecureStore.deleteItemAsync(key);
  },
};
