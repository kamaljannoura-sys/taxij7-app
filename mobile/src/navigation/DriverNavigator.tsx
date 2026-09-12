import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import AccountModal from "../components/AccountModal";
import { useAuth } from "../context/AuthContext";
import DriverHomeScreen from "../screens/driver/DriverHomeScreen";
import RideDetailScreen from "../screens/driver/RideDetailScreen";
import type { DriverStackParamList } from "./types";

const Stack = createNativeStackNavigator<DriverStackParamList>();

export default function DriverNavigator() {
  const { logout } = useAuth();
  const [accountVisible, setAccountVisible] = useState(false);

  return (
    <>
      <Stack.Navigator>
        <Stack.Screen
          name="DriverHome"
          component={DriverHomeScreen}
          options={{
            title: "Mes courses",
            headerRight: () => (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
                <TouchableOpacity onPress={() => setAccountVisible(true)}>
                  <Text style={{ color: "#1565c0" }}>⚙️ Compte</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={logout}>
                  <Text style={{ color: "#1565c0" }}>Déconnexion</Text>
                </TouchableOpacity>
              </View>
            ),
          }}
        />
        <Stack.Screen name="RideDetail" component={RideDetailScreen} options={{ title: "Détail de la course" }} />
      </Stack.Navigator>
      <AccountModal visible={accountVisible} onClose={() => setAccountVisible(false)} />
    </>
  );
}
