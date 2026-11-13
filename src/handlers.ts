// Obsługa wiadomości i kliknięć z Telegrama.
import { nightlyUpdate, petReply } from "./chat";
import { DEFAULT_PET_NAME, LIMITS, NEEDS, WEIGHT } from "./config";
import { morningFor } from "./cron";
import {
  addMessage,
  bumpActivity,
  createUser,
  deleteUserData,
  getTodayMessageCount,
  getUser,
  isDuplicateUpdate,
  logError,
  updateUser,
} from "./db";
import {
  aiErrorText,
  applyAction,
  applyDecay,
  clamp,
  eggReply,
  evolveIfNeeded,
  needsFields,
  needsLine,
  nonTextReply,
  sleepyLimitText,
  stageGroup,
  statusCard,
  type Action,
} from "./pet";
import { buildStats } from "./stats";
import { answerCallback, editMessage, PET_KEYBOARD, sendMessage, sendTyping } from "./telegram";
import { DAY_MS } from "./time";
import { TOPICS } from "./topics";
import type { Env, User } from "./types";
import { geocodeCity } from "./weather";

// ---------- Teksty powitalne ----------

const WELCOME = `Cześć! 👋 To Smartgotchi – wirtualny zwierzak, który rośnie, pamięta wasze rozmowy i z czasem nabiera charakteru.

⚠️ Ważne, zanim zaczniesz:
• To wersja testowa.
• Rozmowy obsługuje AI: Google Gemini w darmowym planie, który może wykorzystywać treści do ulepszania usług Google. Nie pisz więc nic prywatnego (haseł, adresów, danych zdrowotnych, numerów).
• Komenda /usun kasuje wszystkie Twoje dane.

Za chwilę dostaniesz jajko 🥚 Najpierw: jak nazwiesz swojego zwierzaka? Napisz imię albo kliknij przycisk.`;

const HELP = `Co umiem:
• Po prostu pisz – zwierzak odpowie (na początku jako jajko 🥚).
• Przyciski pod wiadomościami: 🍖 Nakarm, 🎾 Pobaw się, 💤 Uśpij.
• 💡 O czym pogadać? (albo /temat) – pomysły, gdy nie wiesz, co napisać.
• /stan – jak się ma zwierzak
• /usun – usuń wszystkie swoje dane
Dziennie możesz wysłać ${LIMITS.dailyMessages} wiadomości. Potem zwierzak idzie spać do jutra.`;

const NOT_INVITED = "To zamknięta wersja testowa 🔒 Poproś osobę, która Cię zaprosiła, o link z zaproszeniem.";

// ---------- Główny punkt wejścia ----------

export async function handleUpdate(env: Env, update: any): Promise<void> {
  if (typeof update?.update_id !== "number") return;
  if (await isDuplicateUpdate(env, update.update_id)) return; // Telegram wysłał to drugi raz

  if (update.message) {
    const msg = update.message;
    if (msg.chat?.type !== "private") return; // obsługujemy tylko prywatne czaty
    try {
      await handleMessage(env, msg);
    } catch (e) {
      await logError(env, `Wiadomość: ${String(e)}`, msg.chat.id);
    }
  } else if (update.callback_query) {
    const cq = update.callback_query;
    try {
      await handleCallback(env, cq);
    } catch (e) {
      await logError(env, `Przycisk: ${String(e)}`, cq.message?.chat?.id ?? null);
    }
  }
}

const isAdmin = (env: Env, chatId: number) => String(chatId) === String(env.ADMIN_CHAT_ID);

// ---------- Wiadomości ----------

async function handleMessage(env: Env, msg: any): Promise<void> {
  const chatId: number = msg.chat.id;
  const text: string = (msg.text ?? "").trim();
  const user = await getUser(env, chatId);

  // Komendy zaczynają się od „/”
  if (text.startsWith("/")) {
    const [rawCommand, ...args] = text.split(/\s+/);
    const command = rawCommand.split("@")[0].toLowerCase(); // „/stan@MojBot” → „/stan”
    return handleCommand(env, chatId, msg, user, command, args);
  }

  if (!user) {
    await sendMessage(env, chatId, NOT_INVITED);
    return;
  }
  if (user.status === "ask_name") return handleNameAnswer(env, user, text);
  if (user.status === "ask_city") return handleCityAnswer(env, user, text);

  await handleChat(env, user, text);
}

async function handleCommand(
  env: Env,
  chatId: number,
  msg: any,
  user: User | null,
  command: string,
  args: string[],
): Promise<void> {
  switch (command) {
    case "/start":
      return handleStart(env, chatId, msg, user, args[0] ?? "");

    case "/temat":
      if (!user || user.status !== "active") {
        await sendMessage(env, chatId, user ? "Najpierw dokończmy zapis 🙂" : NOT_INVITED);
        return;
      }
      return sendIdeas(env, user);

    case "/pomoc":
    case "/help":
      await sendMessage(env, chatId, HELP);
      return;

    case "/stan":
      if (!user || user.status !== "active") {
        await sendMessage(env, chatId, user ? "Najpierw dokończmy zapis 🙂" : NOT_INVITED);
        return;
      }
      applyDecay(user);
      await updateUser(env, chatId, needsFields(user));
      await sendMessage(env, chatId, statusCard(user), PET_KEYBOARD);
      return;

    case "/usun":
      if (!user) {
        await sendMessage(env, chatId, "Nie mam o Tobie żadnych danych 🙂");
        return;
      }
      await sendMessage(env, chatId, "Na pewno usunąć wszystkie Twoje dane? Zwierzak, pamięć i historia rozmów znikną na zawsze.", [
        [
          { text: "🗑 Tak, usuń wszystko", callback_data: "del_yes" },
          { text: "Nie", callback_data: "del_no" },
        ],
      ]);
      return;

    case "/stats":
      if (!isAdmin(env, chatId)) break; // dla innych udajemy, że komendy nie ma
      await sendMessage(env, chatId, await buildStats(env));
      return;

    // ----- Komendy testowe tylko dla admina (działają na JEGO zwierzaku) -----
    case "/test_przewin": {
      if (!isAdmin(env, chatId) || !user?.born_at) break;
      const days = Math.max(1, Math.min(30, Number(args[0]) || 1));
      const fields = { born_at: user.born_at - days * DAY_MS, created_at: user.created_at - days * DAY_MS };
      await updateUser(env, chatId, fields);
      Object.assign(user, fields);
      await sendMessage(env, chatId, `⏩ Przewinięto wiek o ${days} ${days === 1 ? "dzień" : "dni"}.`);
      await evolveIfNeeded(env, user);
      return;
    }
    case "/test_noc":
      if (!isAdmin(env, chatId) || user?.status !== "active") break;
      await nightlyUpdate(env, user);
      await sendMessage(env, chatId, `🌙 Nocne podsumowanie gotowe. Notatka pamięci:\n\n${(await getUser(env, chatId))?.memory || "(pusta)"}`);
      return;
    case "/test_rano":
      if (!isAdmin(env, chatId) || user?.status !== "active") break;
      await morningFor(env, user, true);
      return;
  }
  // Nieznana komenda
  await sendMessage(env, chatId, "Nie znam tej komendy. Spróbuj /pomoc 🙂");
}

// ---------- Zapis (onboarding) ----------

async function handleStart(env: Env, chatId: number, msg: any, user: User | null, code: string): Promise<void> {
  if (user?.status === "active") {
    await sendMessage(env, chatId, `Masz już zwierzaka: ${user.pet_name}! Zobacz /stan albo po prostu napisz 🙂`);
    return;
  }
  if (user) {
    // Ktoś przerwał zapis i zaczyna od nowa – przypominamy, na czym stanęło.
    if (user.status === "ask_name") return askName(env, chatId);
    return askCity(env, chatId);
  }
  // Nowa osoba – sprawdzamy kod zaproszenia (admin nie potrzebuje kodu).
  if (code !== env.INVITE_CODE && !isAdmin(env, chatId)) {
    await sendMessage(env, chatId, NOT_INVITED);
    return;
  }
  await createUser(env, chatId, msg.from?.first_name ?? "przyjaciel");
  await sendMessage(env, chatId, WELCOME, [[{ text: `🐣 ${DEFAULT_PET_NAME}`, callback_data: "name_default" }]]);
}

async function askName(env: Env, chatId: number): Promise<void> {
  await sendMessage(env, chatId, "Jak nazwiesz swojego zwierzaka? Napisz imię albo kliknij przycisk.", [
    [{ text: `🐣 ${DEFAULT_PET_NAME}`, callback_data: "name_default" }],
  ]);
}

async function askCity(env: Env, chatId: number): Promise<void> {
  await sendMessage(
    env,
    chatId,
    "W jakim mieście mieszkasz? Zwierzak będzie wiedział, jaka jest u Ciebie pogoda ☔ Możesz też pominąć.",
    [[{ text: "Pomiń", callback_data: "city_skip" }]],
  );
}

async function handleNameAnswer(env: Env, user: User, text: string): Promise<void> {
  // Imię: 1–20 znaków, bez znaków nowej linii
  const name = text.replace(/\s+/g, " ").trim();
  if (!name || name.length > 20) {
    await sendMessage(env, user.chat_id, "Imię powinno mieć od 1 do 20 znaków. Spróbuj jeszcze raz 🙂");
    return;
  }
  await setName(env, user.chat_id, name);
}

async function setName(env: Env, chatId: number, name: string): Promise<void> {
  await updateUser(env, chatId, { pet_name: name, status: "ask_city" });
  await sendMessage(env, chatId, `${name}… piękne imię! 💛`);
  await askCity(env, chatId);
}

async function handleCityAnswer(env: Env, user: User, text: string): Promise<void> {
  if (!text) return askCity(env, user.chat_id);
  const place = await geocodeCity(text).catch(() => null);
  if (!place) {
    await sendMessage(env, user.chat_id, "Hmm, nie znalazłem takiego miasta. Spróbuj wpisać inaczej albo kliknij Pomiń.", [
      [{ text: "Pomiń", callback_data: "city_skip" }],
    ]);
    return;
  }
  await updateUser(env, user.chat_id, { city_name: place.name, lat: place.lat, lon: place.lon });
  await sendMessage(env, user.chat_id, `📍 Zapisane: ${place.name}${place.region ? ` (${place.region})` : ""}.`);
  await finishOnboarding(env, user);
}

/** Koniec zapisu – użytkownik dostaje jajko. */
async function finishOnboarding(env: Env, user: User): Promise<void> {
  const now = Date.now();
  await updateUser(env, user.chat_id, {
    status: "active",
    born_at: now,
    stage: "jajko",
    hunger: NEEDS.start.hunger,
    mood: NEEDS.start.mood,
    energy: NEEDS.start.energy,
    needs_updated_at: now,
    weight: WEIGHT.start,
    last_summary_at: now,
  });
  const name = (await getUser(env, user.chat_id))?.pet_name ?? DEFAULT_PET_NAME;
  const egg = [
    "      .-\"\"-.",
    "     /      \\",
    "    |   ·    |",
    "     \\      /",
    "      '-..-'",
  ].join("\n");
  await sendMessage(
    env,
    user.chat_id,
    `${egg}\n\nOto Twoje jajko! 🥚 W środku śpi ${name}.\nWykluje się za mniej więcej dobę. Możesz już do niego mówić – ono słyszy 🙂\n\n${HELP}`,
    PET_KEYBOARD,
  );
}

// ---------- Zwykła rozmowa ----------

async function handleChat(env: Env, user: User, text: string): Promise<void> {
  const chatId = user.chat_id;
  const now = Date.now();
  applyDecay(user, now);
  await evolveIfNeeded(env, user, now);

  // Zdjęcia, naklejki, głosówki – bez AI, tylko krótka reakcja.
  if (!text) {
    await sendMessage(env, chatId, nonTextReply(user), PET_KEYBOARD);
    return;
  }

  // Dzienny limit wiadomości
  const unlimited = LIMITS.adminUnlimited && isAdmin(env, chatId);
  if (!unlimited && (await getTodayMessageCount(env, chatId)) >= LIMITS.dailyMessages) {
    await sendMessage(env, chatId, sleepyLimitText(user));
    return;
  }

  await bumpActivity(env, chatId, "messages");
  await addMessage(env, chatId, "user", text.slice(0, LIMITS.maxUserMessageChars));
  user.mood = clamp(user.mood + NEEDS.chatMood, 0, 5);
  user.last_user_msg_at = now;
  await updateUser(env, chatId, { ...needsFields(user), last_user_msg_at: now, missed_sent: 0 });

  // Jajko nie mówi – odpowiada gotowymi opisami, bez AI.
  if (user.stage === "jajko") {
    const reply = eggReply(user, now);
    await addMessage(env, chatId, "pet", reply);
    await sendMessage(env, chatId, reply, PET_KEYBOARD);
    return;
  }

  await sendTyping(env, chatId);
  const reply = await petReply(env, user);
  await sendMessage(env, chatId, reply ?? aiErrorText(user), PET_KEYBOARD);
}

// ---------- Pomysły na rozmowę ----------

/** Losuje `count` różnych numerów z zakresu 0..length-1. */
function randomIndexes(length: number, count: number): number[] {
  const all = Array.from({ length }, (_, i) => i);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, count);
}

/** Wiadomość z pomysłami: 2 rzeczy do opowiedzenia + 3 pytania do kliknięcia. */
async function sendIdeas(env: Env, user: User): Promise<void> {
  const group = stageGroup(user);
  const set = TOPICS[group];
  const tell = randomIndexes(set.tell.length, 2).map((i) => `• ${set.tell[i]}`);
  const questions = randomIndexes(set.questions.length, 3);

  const lines = [
    ...(group === "egg" ? ["🥚 Jajko jeszcze nie mówi, ale wszystko słyszy!", ""] : []),
    "💡 Możesz mu na przykład opowiedzieć:",
    ...tell,
    "",
    "Albo kliknij pytanie poniżej, a od razu trafi do zwierzaka 👇",
  ];
  const text = lines.join("\n");

  await sendMessage(env, user.chat_id, text, [
    ...questions.map((i) => [{ text: set.questions[i], callback_data: `ask:${group}:${i}` }]),
    [{ text: "🔄 Inne pomysły", callback_data: "ideas" }],
  ]);
}

// ---------- Przyciski ----------

async function handleCallback(env: Env, cq: any): Promise<void> {
  const chatId: number | undefined = cq.message?.chat?.id;
  const data: string = cq.data ?? "";
  if (!chatId) return answerCallback(env, cq.id);

  const user = await getUser(env, chatId);
  if (!user) {
    await answerCallback(env, cq.id, "Najpierw /start 🙂");
    return;
  }

  // Potwierdzenie /usun
  if (data === "del_yes") {
    await answerCallback(env, cq.id);
    await deleteUserData(env, chatId);
    await editMessage(env, chatId, cq.message.message_id, "🗑 Wszystkie Twoje dane zostały usunięte. Dzięki za udział w teście! Gdyby co, wystarczy znów kliknąć link z zaproszeniem.");
    return;
  }
  if (data === "del_no") {
    await answerCallback(env, cq.id);
    await editMessage(env, chatId, cq.message.message_id, "Uff! Nic nie usunąłem 🙂");
    return;
  }

  // Zapis
  if (data === "name_default" && user.status === "ask_name") {
    await answerCallback(env, cq.id);
    return setName(env, chatId, DEFAULT_PET_NAME);
  }
  if (data === "city_skip" && user.status === "ask_city") {
    await answerCallback(env, cq.id);
    return finishOnboarding(env, user);
  }

  // Nakarm / Pobaw się / Uśpij
  if ((data === "feed" || data === "play" || data === "sleep") && user.status === "active") {
    await answerCallback(env, cq.id);
    const now = Date.now();
    applyDecay(user, now);
    await evolveIfNeeded(env, user, now);
    const reaction = applyAction(user, data as Action);
    await bumpActivity(env, chatId, "buttons");
    await updateUser(env, chatId, needsFields(user));
    await sendMessage(env, chatId, `${reaction}\n\n${needsLine(user)}`, PET_KEYBOARD);
    return;
  }

  // Pomysły na rozmowę
  if (data === "ideas" && user.status === "active") {
    await answerCallback(env, cq.id);
    return sendIdeas(env, user);
  }
  // Kliknięte pytanie, np. „ask:big:3” – wysyłamy je do zwierzaka jak zwykłą wiadomość.
  if (data.startsWith("ask:") && user.status === "active") {
    const [, group, index] = data.split(":");
    const question = TOPICS[group as keyof typeof TOPICS]?.questions[Number(index)];
    await answerCallback(env, cq.id);
    if (!question) return;
    // Zamieniamy wiadomość z pomysłami na „Ty: …” (i chowamy przyciski, żeby nie klikać dwa razy).
    await editMessage(env, chatId, cq.message.message_id, `💬 Ty: ${question}`);
    return handleChat(env, user, question);
  }

  await answerCallback(env, cq.id); // stary albo nieaktualny przycisk
}
