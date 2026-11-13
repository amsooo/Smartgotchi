// Punkt wejścia Cloudflare Workera.
//  - fetch:     odbiera wiadomości z Telegrama (webhook) i adres /setup
//  - scheduled: zadania okresowe (cron co 5 minut)
import { runCron } from "./cron";
import { logError } from "./db";
import { handleUpdate } from "./handlers";
import { tg } from "./telegram";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Webhook z Telegrama
    if (request.method === "POST" && url.pathname === "/webhook") {
      // Sprawdzamy sekretny nagłówek – bez niego ktoś obcy mógłby udawać Telegrama.
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
      const update = await request.json().catch(() => null);
      // Odpowiadamy Telegramowi od razu, a wiadomość obsługujemy „w tle”.
      // Dzięki temu Telegram nie ponawia wysyłki, gdy AI chwilę myśli.
      ctx.waitUntil(handleUpdate(env, update).catch((e) => logError(env, `Webhook: ${String(e)}`)));
      return new Response("ok");
    }

    // Jednorazowa konfiguracja: podpina webhook i menu komend.
    if (url.pathname === "/setup") {
      if (url.searchParams.get("secret") !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response("Zły sekret w adresie.", { status: 403 });
      }
      return setup(env, url.origin);
    }

    if (url.pathname === "/") {
      return new Response("Smartgotchi działa 🐣", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return new Response("Not found", { status: 404 });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCron(env));
  },
};

/** Ustawia webhook, listę komend i zwraca link z zaproszeniem dla znajomych. */
async function setup(env: Env, origin: string): Promise<Response> {
  const lines: string[] = [];
  try {
    await tg(env, "setWebhook", {
      url: `${origin}/webhook`,
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
    lines.push(`✅ Webhook ustawiony na ${origin}/webhook`);

    await tg(env, "setMyCommands", {
      commands: [
        { command: "stan", description: "Jak się ma zwierzak" },
        { command: "pomoc", description: "Co umiem" },
        { command: "usun", description: "Usuń wszystkie moje dane" },
      ],
    });
    lines.push("✅ Menu komend ustawione");

    const me = await tg(env, "getMe", {});
    lines.push(`✅ Bot: @${me.username}`);
    lines.push("");
    lines.push("Link z zaproszeniem dla znajomych:");
    lines.push(`https://t.me/${me.username}?start=${env.INVITE_CODE}`);
  } catch (e) {
    lines.push(`❌ Błąd: ${String(e)}`);
    lines.push("Sprawdź, czy TELEGRAM_TOKEN jest poprawny (wrangler secret put TELEGRAM_TOKEN).");
  }
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
