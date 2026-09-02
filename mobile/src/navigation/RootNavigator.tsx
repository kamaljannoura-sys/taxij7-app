import { NavigationContainer } from "@react-navigation/native";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import DispatcherNavigator from "./DispatcherNavigator";
import DriverNavigator from "./DriverNavigator";

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <LoginScreen />
      ) : user.role === "DISPATCHER" ? (
        <DispatcherNavigator />
      ) : (
        <DriverNavigator />
      )}
    </NavigationContainer>
  );
}
