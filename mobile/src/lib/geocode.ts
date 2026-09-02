// Autocomplétion d'adresses via Photon (OpenStreetMap) — gratuit, sans clé API.
// Biaisé vers la région de Montréal / Rive-Sud.
const PHOTON_URL = "https://photon.komoot.io/api/";
const BIAS = { lat: 45.53, lon: -73.51 }; // Montréal / Longueuil

export interface AddressSuggestion {
  label: string;
  lat: number;
  lon: number;
}

export function formatAddress(props: Record<string, any>): string {
  const parts: string[] = [];
  const line1 = [props.housenumber, props.street || props.name].filter(Boolean).join(" ");
  if (line1) parts.push(line1);
  else if (props.name) parts.push(props.name);
  if (props.city) parts.push(props.city);
  if (props.postcode) parts.push(props.postcode);
  return parts.join(", ");
}

export async function searchAddress(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `${PHOTON_URL}?q=${encodeURIComponent(q)}&limit=6&lang=fr&lat=${BIAS.lat}&lon=${BIAS.lon}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const seen = new Set<string>();
    const out: AddressSuggestion[] = [];
    for (const f of data.features ?? []) {
      const label = formatAddress(f.properties ?? {});
      if (!label || seen.has(label)) continue;
      seen.add(label);
      const [lon, lat] = f.geometry?.coordinates ?? [];
      out.push({ label, lat, lon });
    }
    return out;
  } catch {
    return [];
  }
}
