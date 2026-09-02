import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { TouchableOpacity, Text } from "react-native";
import { useAuth } from "../context/AuthContext";
import DriverHomeScreen from "../screens/driver/DriverHomeScreen";
import RideDetailScreen from "../screens/driver/RideDetailScreen";
import type { DriverStackParamList } from "./types";

const Stack = createNativeStackNavigator<DriverStackParamList>();

export default function DriverNavigator() {
  const { logout } = useAuth();
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{
          title: "Mes courses",
          headerRight: () => (
            <TouchableOpacity onPress={logout}>
              <Text style={{ color: "#1565c0" }}>Déconnexion</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen name="RideDetail" component={RideDetailScreen} options={{ title: "Détail de la course" }} />
    </Stack.Navigator>
  );
}
