// Budowanie promptu systemowego z pliku persona.md.
// Plik persona.md możesz edytować dowolnie – w miejsca {zmienna} wstawiamy aktualne dane.
import personaTemplate from "../persona.md";
import { parsePhrases } from "./db";
import { nearestHoliday } from "./holidays";
import { silhouette, stageById } from "./pet";
import { warsawTime } from "./time";
import type { Env, User } from "./types";
import { getWeather } from "./weather";

/** Zamienia {klucz} na wartość. Nieznane klucze zostawia bez zmian. */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

/** Tworzy pełny prompt systemowy dla danego użytkownika. */
export async function buildSystemPrompt(env: Env, user: User): Promise<string> {
  const now = warsawTime();
  const stage = stageById(user.stage);
  const weather =
    user.lat != null && user.lon != null
      ? await getWeather(env, user.city_name ?? "u użytkownika", user.lat, user.lon)
      : "nieznana (użytkownik nie podał miasta)";
  const phrases = parsePhrases(user);

  const vars: Record<string, string> = {
    imie: user.pet_name ?? "Pyzio",
    imie_uzytkownika: user.first_name ?? "przyjaciel",
    etap: stage.name,
    charakter: user.character ?? "jeszcze nieukształtowany",
    sylwetka: silhouette(user),
    glod: String(Math.round(user.hunger)),
    nastroj: String(Math.round(user.mood)),
    energia: String(Math.round(user.energy)),
    dzien_tygodnia: now.weekday,
    data: now.dateLong,
    godzina: now.time,
    pogoda: weather,
    swieto: nearestHoliday(now.date, 3),
    pamiec: user.memory.trim() || "(na razie pusto – dopiero się poznajecie)",
    slowka: phrases.length ? phrases.join(", ") : "(jeszcze żadnych)",
  };

  // Krótki dopisek techniczny – żeby AI dobrze rozumiało skalę potrzeb i długość odpowiedzi.
  const footer = [
    "",
    "# Uwagi techniczne",
    "- Skala potrzeb: 5 = w pełni zaspokojone (najedzony, wesoły, wypoczęty), 0 = bardzo głodny / smutny / zmęczony.",
    `- Długość odpowiedzi na tym etapie: ${stage.lengthHint}`,
    "- Piszesz tylko swoją wypowiedź: bez podpisu, bez cudzysłowu, bez formatowania Markdown.",
    "- Wiadomości w nawiasach kwadratowych [tak] to informacje techniczne, a nie słowa użytkownika.",
  ].join("\n");

  return fillTemplate(personaTemplate, vars) + "\n" + footer;
}
