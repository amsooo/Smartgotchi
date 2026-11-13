// Pogoda z Open-Meteo (darmowe, bez klucza).
import { logError } from "./db";
import { HOUR_MS } from "./time";
import type { Env } from "./types";

export interface Place {
  name: string;
  region: string;
  lat: number;
  lon: number;
}

/** Zamienia nazwę miasta na współrzędne. Zwraca null, gdy nic nie znaleziono. */
export async function geocodeCity(name: string): Promise<Place | null> {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search?count=1&language=pl&format=json&name=" +
    encodeURIComponent(name.trim());
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: any = await res.json();
  const r = data?.results?.[0];
  if (!r) return null;
  return {
    name: r.name,
    region: [r.admin1, r.country].filter(Boolean).join(", "),
    lat: r.latitude,
    lon: r.longitude,
  };
}

/** Kody pogody WMO → opis po polsku. */
function describeWeatherCode(code: number): string {
  if (code === 0) return "bezchmurnie";
  if (code === 1) return "przeważnie pogodnie";
  if (code === 2) return "częściowe zachmurzenie";
  if (code === 3) return "pochmurno";
  if (code === 45 || code === 48) return "mgła";
  if (code >= 51 && code <= 55) return "mżawka";
  if (code === 56 || code === 57) return "marznąca mżawka";
  if (code === 61) return "słaby deszcz";
  if (code === 63) return "deszcz";
  if (code === 65) return "ulewa";
  if (code === 66 || code === 67) return "marznący deszcz";
  if (code >= 71 && code <= 75) return "śnieg";
  if (code === 77) return "drobny śnieg";
  if (code >= 80 && code <= 82) return "przelotny deszcz";
  if (code === 85 || code === 86) return "przelotny śnieg";
  if (code === 95) return "burza";
  if (code === 96 || code === 99) return "burza z gradem";
  return "pogoda trudna do opisania";
}

/**
 * Zwraca opis pogody dla miasta użytkownika.
 * Wynik trzymamy w bazie i odświeżamy najwyżej raz na godzinę.
 */
export async function getWeather(env: Env, city: string, lat: number, lon: number): Promise<string> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = await env.DB.prepare("SELECT text, updated_at FROM weather_cache WHERE key = ?")
    .bind(key)
    .first<{ text: string; updated_at: number }>();
  if (cached && Date.now() - cached.updated_at < HOUR_MS) return cached.text;

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      "&current=temperature_2m,weather_code,is_day,wind_speed_10m&timezone=Europe%2FWarsaw";
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    const data: any = await res.json();
    const c = data.current;
    let text = `${city}: ${Math.round(c.temperature_2m)}°C, ${describeWeatherCode(c.weather_code)}`;
    if (c.wind_speed_10m >= 30) text += ", mocno wieje";
    if (!c.is_day) text += ", na dworze ciemno";
    await env.DB.prepare(
      `INSERT INTO weather_cache (key, text, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET text = excluded.text, updated_at = excluded.updated_at`,
    )
      .bind(key, text, Date.now())
      .run();
    return text;
  } catch (e) {
    await logError(env, `Pogoda: ${String(e)}`);
    return cached?.text ?? "nieznana";
  }
}
