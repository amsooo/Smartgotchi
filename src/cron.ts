// Zadania okresowe. Cloudflare uruchamia tę funkcję co 5 minut (w UTC),
// a my sprawdzamy godzinę POLSKĄ i decydujemy, co zrobić. Dzięki temu
// czas letni i zimowy nie ma znaczenia.
import { morningGreeting, nightlyUpdate } from "./chat";
import { LIMITS, SCHEDULE } from "./config";
import { cleanupOldData, getActiveUsers, getMeta, logError, setMeta, updateUser } from "./db";
import { eggMorningText, evolveIfNeeded, missYouText } from "./pet";
import { buildStats } from "./stats";
import { PET_KEYBOARD, sendMessage } from "./telegram";
import { DAY_MS, warsawTime } from "./time";
import type { Env, User } from "./types";

export async function runCron(env: Env): Promise<void> {
  const now = warsawTime();
  const tasks: [string, () => Promise<void>][] = [];

  if (now.hour >= SCHEDULE.evolutionFromHour && now.hour < SCHEDULE.evolutionToHour) {
    tasks.push(["ewolucje", () => checkEvolutions(env)]);
  }
  if (now.minutesOfDay >= SCHEDULE.morningFromMinute && now.minutesOfDay <= SCHEDULE.morningToMinute + 15) {
    tasks.push(["poranek", () => runMorning(env)]);
  }
  if (now.hour >= SCHEDULE.nightFromHour && now.hour < SCHEDULE.nightToHour) {
    tasks.push(["noc", () => runNight(env)]);
  }
  if (now.hour === SCHEDULE.reportHour) {
    tasks.push(["raport", () => runReport(env)]);
  }

  for (const [name, task] of tasks) {
    try {
      await task();
    } catch (e) {
      await logError(env, `Cron (${name}): ${String(e)}`);
    }
  }
}

/** Wysyła komunikaty o ewolucji, jeśli komuś minął czas etapu. */
async function checkEvolutions(env: Env): Promise<void> {
  for (const user of await getActiveUsers(env)) {
    try {
      await evolveIfNeeded(env, user);
    } catch (e) {
      await logError(env, `Ewolucja: ${String(e)}`, user.chat_id);
    }
  }
}

/** Prosty hash tekstu – żeby każdy dostał inną, ale stałą na dany dzień godzinę porannej wiadomości. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** Minuta dnia (czas polski), o której dany użytkownik dostanie dziś poranną wiadomość. */
export function morningMinuteFor(chatId: number, date: string): number {
  const span = SCHEDULE.morningToMinute - SCHEDULE.morningFromMinute + 1;
  return SCHEDULE.morningFromMinute + (hash(`${chatId}-${date}`) % span);
}

async function runMorning(env: Env): Promise<void> {
  const now = warsawTime();
  const due = (await getActiveUsers(env)).filter(
    (u) => u.last_morning_date !== now.date && now.minutesOfDay >= morningMinuteFor(u.chat_id, now.date),
  );
  for (const user of due.slice(0, SCHEDULE.batchSize)) {
    try {
      await morningFor(env, user);
    } catch (e) {
      await logError(env, `Poranek: ${String(e)}`, user.chat_id);
    }
  }
}

/**
 * Poranna wiadomość dla jednej osoby.
 * - aktywni w ostatnich 3 dniach: zwierzak sam zagaduje,
 * - cisza od 3 dni: jedno „tęsknię”, potem cisza aż do powrotu.
 */
export async function morningFor(env: Env, user: User, force = false): Promise<void> {
  const now = Date.now();
  const today = warsawTime(now).date;
  await updateUser(env, user.chat_id, { last_morning_date: today }); // najpierw oznaczamy, żeby nie wysłać dwa razy

  const last = user.last_user_msg_at ?? user.born_at ?? now;
  const wroteToday = user.last_user_msg_at != null && warsawTime(user.last_user_msg_at).date === today;
  if (wroteToday && !force) return; // już dziś rozmawialiście – nie ma co zagadywać

  if (now - last > LIMITS.inactiveDays * DAY_MS && !force) {
    if (!user.missed_sent) {
      await sendMessage(env, user.chat_id, missYouText(user));
      await updateUser(env, user.chat_id, { missed_sent: 1 });
    }
    return;
  }

  if (user.stage === "jajko") {
    await sendMessage(env, user.chat_id, eggMorningText(), PET_KEYBOARD);
    return;
  }
  const text = await morningGreeting(env, user);
  if (text) await sendMessage(env, user.chat_id, text, PET_KEYBOARD);
}

async function runNight(env: Env): Promise<void> {
  const today = warsawTime().date;
  const due = (await getActiveUsers(env)).filter((u) => u.last_night_date !== today);
  for (const user of due.slice(0, SCHEDULE.batchSize)) {
    try {
      await nightlyUpdate(env, user);
    } catch (e) {
      await logError(env, `Noc: ${String(e)}`, user.chat_id);
    }
  }
  // Sprzątanie raz na noc
  if ((await getMeta(env, "last_cleanup")) !== today) {
    await cleanupOldData(env);
    await setMeta(env, "last_cleanup", today);
  }
}

async function runReport(env: Env): Promise<void> {
  const today = warsawTime().date;
  if ((await getMeta(env, "last_report")) === today) return;
  await setMeta(env, "last_report", today);
  await sendMessage(env, env.ADMIN_CHAT_ID, await buildStats(env));
}
