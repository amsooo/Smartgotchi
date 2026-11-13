// Rozmowa ze zwierzakiem przez AI: zwykłe odpowiedzi, poranne zagadanie i nocne streszczenie.
import { LIMITS, WEIGHT } from "./config";
import {
  addMessage,
  hadActivityOn,
  logError,
  messagesSince,
  parsePhrases,
  parseTraits,
  recentMessages,
  updateUser,
} from "./db";
import { askGemini, GeminiError, type GeminiTurn } from "./gemini";
import { applyDecay, clamp, needsFields } from "./pet";
import { buildSystemPrompt } from "./persona";
import { addDays, warsawTime } from "./time";
import type { ChatMessage, Env, Traits, User } from "./types";

/** Zamienia historię z bazy na format Gemini. */
function toTurns(history: ChatMessage[]): GeminiTurn[] {
  return history.map((m) => ({ role: m.role === "user" ? "user" : "model", text: m.text }));
}

/** Krótki opis błędu do logu (bez treści rozmowy). */
function describeError(e: unknown): string {
  if (e instanceof GeminiError) return e.status === 429 ? "Gemini 429 (limit)" : e.message;
  return String(e);
}

/**
 * Odpowiedź zwierzaka na wiadomość użytkownika.
 * Wiadomość użytkownika musi już być zapisana w bazie (trafia do historii).
 * Zwraca null, gdy AI zawiodło (błąd jest zapisany w logu).
 */
export async function petReply(env: Env, user: User): Promise<string | null> {
  try {
    const system = await buildSystemPrompt(env, user);
    const history = await recentMessages(env, user.chat_id, LIMITS.historyMessages);
    const reply = await askGemini(env, system, toTurns(history));
    await addMessage(env, user.chat_id, "pet", reply);
    return reply;
  } catch (e) {
    await logError(env, `Odpowiedź AI: ${describeError(e)}`, user.chat_id);
    return null;
  }
}

/** Poranne zagadanie (tylko dla aktywnych użytkowników po wykluciu). Zwraca tekst albo null. */
export async function morningGreeting(env: Env, user: User): Promise<string | null> {
  try {
    const system = await buildSystemPrompt(env, user);
    const history = await recentMessages(env, user.chat_id, LIMITS.historyMessages);
    const turns = toTurns(history);
    turns.push({
      role: "user",
      text:
        "[Jest ranek. Użytkownik jeszcze dziś nie pisał. Napisz sam pierwszą, krótką wiadomość na dzień dobry. " +
        "Jeśli w pamięci jest jakaś sprawa do dopytania, nawiąż do niej naturalnie. " +
        "Nie pytaj, czemu nie pisał, i nie wywołuj poczucia winy.]",
    });
    const text = await askGemini(env, system, turns);
    await addMessage(env, user.chat_id, "pet", text);
    return text;
  } catch (e) {
    await logError(env, `Poranek AI: ${describeError(e)}`, user.chat_id);
    return null;
  }
}

// ---------- Nocne streszczenie ----------

/** Cechy oceniane przez AI (późne pory i zaniedbanie liczy kod). */
const AI_TRAITS = ["zarty", "zycie", "zagadki", "ciekawosc", "sport", "lagodnosc", "sztuka"] as const;

const SUMMARY_SCHEMA = {
  type: "OBJECT",
  properties: {
    pamiec: { type: "STRING" },
    slowka: { type: "ARRAY", items: { type: "STRING" } },
    cechy: {
      type: "OBJECT",
      properties: Object.fromEntries(AI_TRAITS.map((t) => [t, { type: "INTEGER" }])),
      required: [...AI_TRAITS],
    },
  },
  required: ["pamiec", "slowka", "cechy"],
};

const SUMMARY_PROMPT = `Prowadzisz notatki dla wirtualnego zwierzaka, który rozmawia z użytkownikiem w Telegramie.
Dostajesz dotychczasową notatkę o użytkowniku i rozmowy od ostatniego podsumowania. Zwróć JSON:

- "pamiec": zaktualizowana notatka po polsku, maksymalnie ${LIMITS.memoryMaxChars} znaków, w krótkich punktach.
  Trzy sekcje: "Fakty" (o użytkowniku: praca, bliscy, zainteresowania), "Wydarzenia" (ważne rzeczy z datami),
  "Do dopytania" (sprawy w toku, np. rozmowa o pracę w piątek). Nowe informacje dopisuj, starsze i mniej ważne skracaj
  albo łącz. Usuwaj sprawy już załatwione. Nie zapisuj haseł, numerów telefonów, adresów ani danych kart.
  Zapisuj tylko to, co naprawdę padło w rozmowie. Nie zgaduj.
- "slowka": 3–5 charakterystycznych słówek lub powiedzonek UŻYTKOWNIKA, dokładnie tak, jak je pisze.
  Zachowaj dotychczasowe, jeśli nadal pasują. Gdy nic charakterystycznego nie ma, zwróć dotychczasowe.
- "cechy": punkty 0–3 za DZISIEJSZE rozmowy (0 = wcale, 3 = bardzo dużo):
  zarty (żarty, wygłupy), zycie (rozmowy o życiu, uczuciach), zagadki (zagadki, pytania, łamigłówki),
  ciekawosc (ciekawość świata, nauka, podróże), sport (ruch, sport, aktywność), lagodnosc (czułość, łagodność),
  sztuka (pasje, muzyka, sztuka, tworzenie).`;

/**
 * Nocne zadanie dla jednego użytkownika:
 * streszczenie rozmów → notatka pamięci, słówka, cechy charakteru, spadek wagi.
 */
export async function nightlyUpdate(env: Env, user: User): Promise<void> {
  const now = Date.now();
  const today = warsawTime(now).date;
  const yesterday = addDays(today, -1);
  const since = user.last_summary_at ?? 0;
  const messages = await messagesSince(env, user.chat_id, since);
  const userMessages = messages.filter((m) => m.role === "user");

  const traits: Traits = parseTraits(user);
  let memory = user.memory;
  let phrases = parsePhrases(user);
  let summaryOk = true;

  // 1) Streszczenie przez AI – tylko gdy użytkownik coś pisał.
  if (userMessages.length > 0) {
    const petName = user.pet_name ?? "Pyzio";
    let transcript = messages
      .map((m) => `[${warsawTime(m.created_at).time}] ${m.role === "user" ? "Użytkownik" : petName}: ${m.text}`)
      .join("\n");
    if (transcript.length > 12000) transcript = transcript.slice(-12000); // bierzemy końcówkę

    const input = [
      `Dzisiejsza data: ${warsawTime(now).dateLong}`,
      "",
      "Dotychczasowa notatka:",
      memory.trim() || "(pusta)",
      "",
      `Dotychczasowe słówka: ${phrases.length ? phrases.join(", ") : "(brak)"}`,
      "",
      "Rozmowy od ostatniego podsumowania:",
      transcript,
    ].join("\n");

    try {
      const raw = await askGemini(env, SUMMARY_PROMPT, [{ role: "user", text: input }], {
        temperature: 0.3,
        maxOutputTokens: 2048,
        jsonSchema: SUMMARY_SCHEMA,
      });
      const data = JSON.parse(raw);
      if (typeof data.pamiec === "string" && data.pamiec.trim()) {
        memory = data.pamiec.trim().slice(0, LIMITS.memoryMaxChars);
      }
      if (Array.isArray(data.slowka)) {
        const fresh = data.slowka.map(String).map((s: string) => s.trim()).filter(Boolean).slice(0, 5);
        if (fresh.length) phrases = fresh;
      }
      for (const t of AI_TRAITS) {
        traits[t] += clamp(Math.round(Number(data.cechy?.[t]) || 0), 0, 3);
      }
    } catch (e) {
      summaryOk = false;
      await logError(env, `Nocne streszczenie: ${describeError(e)}`, user.chat_id);
    }
  }

  // 2) Cechy liczone przez kod.
  // Późne pory: wiadomości między 23:00 a 4:59.
  const late = userMessages.filter((m) => {
    const h = warsawTime(m.created_at).hour;
    return h >= 23 || h < 5;
  }).length;
  traits.pozne_pory += Math.min(3, late);
  // Zaniedbanie: wczoraj zero wiadomości i zero kliknięć.
  if (!(await hadActivityOn(env, user.chat_id, yesterday))) traits.zaniedbanie += 2;

  // 3) Potrzeby i waga.
  applyDecay(user, now);
  user.weight = clamp(user.weight - WEIGHT.nightlyLoss, 0, WEIGHT.max);

  await updateUser(env, user.chat_id, {
    ...needsFields(user),
    memory,
    phrases: JSON.stringify(phrases),
    traits: JSON.stringify(traits),
    last_night_date: today,
    // Jeśli AI zawiodło, nie przesuwamy znacznika – jutro streścimy dwa dni naraz.
    ...(summaryOk ? { last_summary_at: now } : {}),
  });
}
