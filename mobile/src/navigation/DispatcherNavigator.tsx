import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { Text, TouchableOpacity } from "react-native";
import { useAuth } from "../context/AuthContext";
import DriverListScreen from "../screens/dispatcher/DriverListScreen";
import DriverMapScreen from "../screens/dispatcher/DriverMapScreen";
import NewRideScreen from "../screens/dispatcher/NewRideScreen";
import RideHistoryScreen from "../screens/dispatcher/RideHistoryScreen";
import type { DispatcherTabParamList } from "./types";

const Tab = createBottomTabNavigator<DispatcherTabParamList>();

export default function DispatcherNavigator() {
  const { logout } = useAuth();
  const headerRight = () => (
    <TouchableOpacity onPress={logout} style={{ marginRight: 12 }}>
      <Text style={{ color: "#1565c0" }}>Déconnexion</Text>
    </TouchableOpacity>
  );

  return (
    <Tab.Navigator screenOptions={{ headerRight }}>
      <Tab.Screen name="Drivers" component={DriverListScreen} options={{ title: "Chauffeurs" }} />
      <Tab.Screen name="Map" component={DriverMapScreen} options={{ title: "Carte" }} />
      <Tab.Screen name="NewRide" component={NewRideScreen} options={{ title: "Nouvelle course" }} />
      <Tab.Screen name="History" component={RideHistoryScreen} options={{ title: "Courses" }} />
    </Tab.Navigator>
  );
}
