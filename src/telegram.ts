// Komunikacja z Telegram Bot API.
import type { Env } from "./types";

export interface InlineButton {
  text: string;
  callback_data: string;
}
export type InlineKeyboard = InlineButton[][];

/** Przyciski pod odpowiedziami zwierzaka. */
export const PET_KEYBOARD: InlineKeyboard = [
  [
    { text: "🍖 Nakarm", callback_data: "feed" },
    { text: "🎾 Pobaw się", callback_data: "play" },
    { text: "💤 Uśpij", callback_data: "sleep" },
  ],
];

/** Wywołuje dowolną metodę Telegram Bot API. */
export async function tg(env: Env, method: string, body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!data.ok) {
    // Nie logujemy tokena – tylko nazwę metody i opis błędu.
    throw new Error(`Telegram ${method}: ${res.status} ${data.description ?? ""}`);
  }
  return data.result;
}

export async function sendMessage(
  env: Env,
  chatId: number | string,
  text: string,
  keyboard?: InlineKeyboard,
): Promise<void> {
  await tg(env, "sendMessage", {
    chat_id: chatId,
    text,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

/** Pokazuje „pisze…” u góry czatu, gdy czekamy na AI. */
export async function sendTyping(env: Env, chatId: number): Promise<void> {
  await tg(env, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
}

/** Potwierdza kliknięcie przycisku (inaczej Telegram pokazuje kręciołek). */
export async function answerCallback(env: Env, callbackId: string, text?: string): Promise<void> {
  await tg(env, "answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) }).catch(() => {});
}

/** Zmienia treść wcześniej wysłanej wiadomości (np. po potwierdzeniu /usun). */
export async function editMessage(env: Env, chatId: number, messageId: number, text: string): Promise<void> {
  await tg(env, "editMessageText", { chat_id: chatId, message_id: messageId, text }).catch(() => {});
}
