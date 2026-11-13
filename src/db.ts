// Wszystkie operacje na bazie danych D1 w jednym miejscu.
import { LIMITS } from "./config";
import { DAY_MS, warsawTime } from "./time";
import type { ChatMessage, Env, Traits, User } from "./types";

// ---------- Użytkownicy ----------

export async function getUser(env: Env, chatId: number): Promise<User | null> {
  return await env.DB.prepare("SELECT * FROM users WHERE chat_id = ?").bind(chatId).first<User>();
}

/** Zapisuje wybrane pola użytkownika, np. updateUser(env, id, { mood: 3 }). */
export async function updateUser(env: Env, chatId: number, fields: Partial<User>): Promise<void> {
  const keys = Object.keys(fields) as (keyof User)[];
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => fields[k] ?? null);
  await env.DB.prepare(`UPDATE users SET ${sets} WHERE chat_id = ?`).bind(...values, chatId).run();
}

export async function createUser(env: Env, chatId: number, firstName: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO users (chat_id, first_name, status, created_at) VALUES (?, ?, 'ask_name', ?)",
  )
    .bind(chatId, firstName, Date.now())
    .run();
}

/** Wszyscy aktywni użytkownicy (po zakończeniu zapisu). */
export async function getActiveUsers(env: Env): Promise<User[]> {
  const res = await env.DB.prepare("SELECT * FROM users WHERE status = 'active'").all<User>();
  return res.results;
}

/** Usuwa WSZYSTKIE dane użytkownika (komenda /usun). */
export async function deleteUserData(env: Env, chatId: number): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM messages WHERE chat_id = ?").bind(chatId),
    env.DB.prepare("DELETE FROM activity WHERE chat_id = ?").bind(chatId),
    env.DB.prepare("DELETE FROM logs WHERE chat_id = ?").bind(chatId),
    env.DB.prepare("DELETE FROM users WHERE chat_id = ?").bind(chatId),
  ]);
}

// ---------- Cechy i słówka (przechowywane jako JSON) ----------

export const EMPTY_TRAITS: Traits = {
  zarty: 0,
  zycie: 0,
  zagadki: 0,
  ciekawosc: 0,
  sport: 0,
  lagodnosc: 0,
  sztuka: 0,
  pozne_pory: 0,
  zaniedbanie: 0,
};

export function parseTraits(user: User): Traits {
  try {
    return { ...EMPTY_TRAITS, ...JSON.parse(user.traits || "{}") };
  } catch {
    return { ...EMPTY_TRAITS };
  }
}

export function parsePhrases(user: User): string[] {
  try {
    const arr = JSON.parse(user.phrases || "[]");
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

// ---------- Wiadomości ----------

export async function addMessage(env: Env, chatId: number, role: "user" | "pet", text: string): Promise<void> {
  await env.DB.prepare("INSERT INTO messages (chat_id, role, text, created_at) VALUES (?, ?, ?, ?)")
    .bind(chatId, role, text, Date.now())
    .run();
}

/** Ostatnie N wiadomości, od najstarszej do najnowszej. */
export async function recentMessages(env: Env, chatId: number, limit: number): Promise<ChatMessage[]> {
  const res = await env.DB.prepare(
    "SELECT role, text, created_at FROM messages WHERE chat_id = ? ORDER BY id DESC LIMIT ?",
  )
    .bind(chatId, limit)
    .all<ChatMessage>();
  return res.results.reverse();
}

/** Wiadomości od podanego momentu (do nocnego streszczenia). */
export async function messagesSince(env: Env, chatId: number, since: number): Promise<ChatMessage[]> {
  const res = await env.DB.prepare(
    "SELECT role, text, created_at FROM messages WHERE chat_id = ? AND created_at > ? ORDER BY id ASC LIMIT 300",
  )
    .bind(chatId, since)
    .all<ChatMessage>();
  return res.results;
}

// ---------- Aktywność dzienna (limit wiadomości + statystyki) ----------

export async function getTodayMessageCount(env: Env, chatId: number): Promise<number> {
  const row = await env.DB.prepare("SELECT messages FROM activity WHERE chat_id = ? AND day = ?")
    .bind(chatId, warsawTime().date)
    .first<{ messages: number }>();
  return row?.messages ?? 0;
}

/** Zwiększa licznik wiadomości lub kliknięć przycisków na dziś. */
export async function bumpActivity(env: Env, chatId: number, kind: "messages" | "buttons"): Promise<void> {
  const day = warsawTime().date;
  await env.DB.prepare(
    `INSERT INTO activity (chat_id, day, ${kind}) VALUES (?, ?, 1)
     ON CONFLICT(chat_id, day) DO UPDATE SET ${kind} = ${kind} + 1`,
  )
    .bind(chatId, day)
    .run();
}

export async function hadActivityOn(env: Env, chatId: number, day: string): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT messages + buttons AS n FROM activity WHERE chat_id = ? AND day = ?",
  )
    .bind(chatId, day)
    .first<{ n: number }>();
  return (row?.n ?? 0) > 0;
}

// ---------- Powtórzone aktualizacje Telegrama ----------

/** Zwraca true, jeśli tę aktualizację już obsłużyliśmy (Telegram czasem wysyła ją ponownie). */
export async function isDuplicateUpdate(env: Env, updateId: number): Promise<boolean> {
  const res = await env.DB.prepare(
    "INSERT OR IGNORE INTO processed_updates (update_id, created_at) VALUES (?, ?)",
  )
    .bind(updateId, Date.now())
    .run();
  return res.meta.changes === 0;
}

// ---------- Liczniki, logi, ustawienia ----------

export async function incCounter(env: Env, name: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO counters (day, name, value) VALUES (?, ?, 1)
     ON CONFLICT(day, name) DO UPDATE SET value = value + 1`,
  )
    .bind(warsawTime().date, name)
    .run();
}

export async function getCounter(env: Env, name: string, day: string): Promise<number> {
  const row = await env.DB.prepare("SELECT value FROM counters WHERE day = ? AND name = ?")
    .bind(day, name)
    .first<{ value: number }>();
  return row?.value ?? 0;
}

/** Zapisuje błąd do tabeli logs (i do konsoli – widać ją w panelu Cloudflare). */
export async function logError(env: Env, message: string, chatId: number | null = null): Promise<void> {
  console.error(message);
  try {
    await env.DB.prepare("INSERT INTO logs (created_at, day, level, chat_id, message) VALUES (?, ?, 'error', ?, ?)")
      .bind(Date.now(), warsawTime().date, chatId, message.slice(0, 2000))
      .run();
  } catch (e) {
    console.error("Nie udało się zapisać logu", e);
  }
}

export async function getMeta(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM meta WHERE key = ?").bind(key).first<{ value: string }>();
  return row?.value ?? null;
}

export async function setMeta(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  )
    .bind(key, value)
    .run();
}

/** Sprzątanie starych danych (wywoływane w nocy). */
export async function cleanupOldData(env: Env): Promise<void> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM messages WHERE created_at < ?").bind(now - LIMITS.keepMessagesDays * DAY_MS),
    env.DB.prepare("DELETE FROM processed_updates WHERE created_at < ?").bind(now - 3 * DAY_MS),
    env.DB.prepare("DELETE FROM logs WHERE created_at < ?").bind(now - LIMITS.keepLogsDays * DAY_MS),
  ]);
}
