// Wspólne typy używane w całym projekcie.
import type { StageId } from "./config";

/** Zmienne środowiskowe i sekrety (ustawiane w wrangler.toml i przez `wrangler secret put`). */
export interface Env {
  DB: D1Database;
  GEMINI_MODEL: string;
  TELEGRAM_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  GEMINI_API_KEY: string;
  ADMIN_CHAT_ID: string;
  INVITE_CODE: string;
}

/** Status użytkownika: w trakcie zapisu albo aktywny. */
export type UserStatus = "ask_name" | "ask_city" | "active";

/** Cechy charakteru – punkty zbierane każdej nocy. */
export interface Traits {
  zarty: number;
  zycie: number;
  zagadki: number;
  ciekawosc: number;
  sport: number;
  lagodnosc: number;
  sztuka: number;
  pozne_pory: number;
  zaniedbanie: number;
}

/** Wiersz z tabeli `users`. */
export interface User {
  chat_id: number;
  first_name: string | null;
  status: UserStatus;
  pet_name: string | null;
  city_name: string | null;
  lat: number | null;
  lon: number | null;
  created_at: number;
  born_at: number | null;
  stage: StageId;
  character: string | null;
  hunger: number;
  mood: number;
  energy: number;
  needs_updated_at: number | null;
  weight: number;
  feeds_total: number;
  memory: string;
  phrases: string; // JSON: string[]
  traits: string; // JSON: Traits
  last_user_msg_at: number | null;
  last_summary_at: number | null;
  last_night_date: string | null;
  last_morning_date: string | null;
  missed_sent: number;
}

/** Wiadomość z historii rozmowy. */
export interface ChatMessage {
  role: "user" | "pet";
  text: string;
  created_at: number;
}
