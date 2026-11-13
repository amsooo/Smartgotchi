// Statystyki testu: komenda /stats i codzienny raport o 21:00.
import { getCounter } from "./db";
import { daysBetween, warsawTime } from "./time";
import type { Env } from "./types";

interface UserRow {
  chat_id: number;
  first_name: string | null;
  pet_name: string | null;
  status: string;
  born_at: number | null;
  created_at: number;
}
interface ActivityRow {
  chat_id: number;
  day: string;
  messages: number;
  buttons: number;
}

export async function buildStats(env: Env): Promise<string> {
  const now = warsawTime();
  const today = now.date;

  const users = (await env.DB.prepare(
    "SELECT chat_id, first_name, pet_name, status, born_at, created_at FROM users",
  ).all<UserRow>()).results;
  const activity = (await env.DB.prepare("SELECT chat_id, day, messages, buttons FROM activity").all<ActivityRow>())
    .results;

  const active = users.filter((u) => u.status === "active");
  const onboarding = users.length - active.length;

  // Dzisiejsza aktywność
  const todayRows = activity.filter((a) => a.day === today && a.messages + a.buttons > 0);
  const todayMessages = todayRows.reduce((s, a) => s + a.messages, 0);
  const perPerson = todayRows
    .sort((a, b) => b.messages - a.messages)
    .map((a) => {
      const u = users.find((x) => x.chat_id === a.chat_id);
      const label = `${u?.first_name ?? "?"} (${u?.pet_name ?? "?"})`;
      return `  • ${label}: ${a.messages} 💬, ${a.buttons} 🔘`;
    });

  // Powroty: czy ktoś wrócił (napisał lub kliknął) co najmniej N dni po starcie.
  const returns = [1, 3, 7].map((n) => {
    let eligible = 0;
    let returned = 0;
    for (const u of active) {
      const start = warsawTime(u.born_at ?? u.created_at).date;
      if (daysBetween(start, today) < n) continue; // za wcześnie, żeby oceniać
      eligible++;
      const came = activity.some(
        (a) => a.chat_id === u.chat_id && a.messages + a.buttons > 0 && daysBetween(start, a.day) >= n,
      );
      if (came) returned++;
    }
    const pct = eligible ? ` (${Math.round((returned / eligible) * 100)}%)` : "";
    return `  • po ${n} ${n === 1 ? "dniu" : "dniach"}: ${returned}/${eligible}${pct}`;
  });

  const gemini = await getCounter(env, "gemini", today);
  const errors = await env.DB.prepare("SELECT COUNT(*) AS n FROM logs WHERE day = ? AND level = 'error'")
    .bind(today)
    .first<{ n: number }>();

  const avg = todayRows.length ? (todayMessages / todayRows.length).toFixed(1).replace(".", ",") : "0";

  return [
    `📊 Smartgotchi – ${now.dateLong}, ${now.time}`,
    "",
    `Testerzy: ${active.length}${onboarding ? ` (+${onboarding} w trakcie zapisu)` : ""}`,
    `Aktywni dziś: ${todayRows.length}`,
    `Wiadomości dziś: ${todayMessages} (średnio ${avg} na aktywną osobę)`,
    ...perPerson,
    "",
    "Powroty (aktywność co najmniej N dni po starcie):",
    ...returns,
    "",
    `Zapytania do Gemini dziś: ${gemini}`,
    `Błędy dziś: ${errors?.n ?? 0}`,
  ].join("\n");
}
