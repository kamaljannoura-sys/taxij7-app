import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import AccountModal from "../components/AccountModal";
import { useAuth } from "../context/AuthContext";
import DriverListScreen from "../screens/dispatcher/DriverListScreen";
import DriverMapScreen from "../screens/dispatcher/DriverMapScreen";
import NewRideScreen from "../screens/dispatcher/NewRideScreen";
import RideHistoryScreen from "../screens/dispatcher/RideHistoryScreen";
import type { DispatcherTabParamList } from "./types";

const Tab = createBottomTabNavigator<DispatcherTabParamList>();

export default function DispatcherNavigator() {
  const { logout } = useAuth();
  const [accountVisible, setAccountVisible] = useState(false);

  const headerRight = () => (
    <View style={{ flexDirection: "row", alignItems: "center", marginRight: 12, gap: 16 }}>
      <TouchableOpacity onPress={() => setAccountVisible(true)}>
        <Text style={{ color: "#1565c0" }}>⚙️ Compte</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={logout}>
        <Text style={{ color: "#1565c0" }}>Déconnexion</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <>
      <Tab.Navigator screenOptions={{ headerRight }}>
        <Tab.Screen name="Drivers" component={DriverListScreen} options={{ title: "Chauffeurs" }} />
        <Tab.Screen name="Map" component={DriverMapScreen} options={{ title: "Carte" }} />
        <Tab.Screen name="NewRide" component={NewRideScreen} options={{ title: "Nouvelle course" }} />
        <Tab.Screen name="History" component={RideHistoryScreen} options={{ title: "Courses" }} />
      </Tab.Navigator>
      <AccountModal visible={accountVisible} onClose={() => setAccountVisible(false)} />
    </>
  );
}
