import { Linking, Platform } from "react-native";

// Sur le web, react-native-web ouvre les liens tel:/sms: via window.open(),
// que plusieurs navigateurs mobiles bloquent ou n'utilisent pas pour
// déclencher le gestionnaire du système (appel/SMS) — contrairement à une
// navigation directe (window.location.href), qui fonctionne de façon fiable.
function openContactLink(url: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      window.location.href = url;
    }
    return;
  }
  Linking.openURL(url).catch(() => {});
}

export const callPhone = (phone: string) => openContactLink(`tel:${phone}`);
export const messagePhone = (phone: string) => openContactLink(`sms:${phone}`);
