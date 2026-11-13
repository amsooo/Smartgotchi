// Logika zwierzaka: wiek, etapy, potrzeby, sylwetka, charakter i gotowe teksty.
import { CHARACTER_STAGE, NEEDS, STAGES, WEIGHT, type Stage, type StageId } from "./config";
import { parseTraits, updateUser } from "./db";
import { sendMessage } from "./telegram";
import { DAY_MS, HOUR_MS } from "./time";
import type { Env, Traits, User } from "./types";

// ---------- Pomocnicze ----------

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
/** Wstawia imię zwierzaka w miejsce {imie}. */
const withName = (text: string, user: User) => text.replaceAll("{imie}", user.pet_name ?? "Pyzio");

// ---------- Wiek i etapy ----------

/** Dzień życia (0 = pierwsze 24 h od dostania jajka). */
export function ageDays(user: User, now = Date.now()): number {
  return Math.max(0, Math.floor((now - (user.born_at ?? now)) / DAY_MS));
}

export function stageById(id: StageId): Stage {
  return STAGES.find((s) => s.id === id) ?? STAGES[0];
}

/** Etap, który zwierzak POWINIEN mieć w danym wieku. */
export function stageForAge(days: number): Stage {
  let current = STAGES[0];
  for (const s of STAGES) if (days >= s.fromDay) current = s;
  return current;
}

const stageIndex = (id: StageId) => STAGES.findIndex((s) => s.id === id);

// ---------- Potrzeby ----------

/**
 * Potrzeby spadają z czasem. Zamiast liczyć to co chwilę cronem,
 * przeliczamy je „na żądanie” – na podstawie czasu od ostatniej aktualizacji.
 * Zmienia obiekt `user` (bez zapisu do bazy).
 */
export function applyDecay(user: User, now = Date.now()): void {
  const last = user.needs_updated_at ?? now;
  const hours = Math.max(0, (now - last) / HOUR_MS);
  user.hunger = clamp(user.hunger - hours / NEEDS.hoursPerPoint.hunger, 0, 5);
  user.mood = clamp(user.mood - hours / NEEDS.hoursPerPoint.mood, 0, 5);
  user.energy = clamp(user.energy - hours / NEEDS.hoursPerPoint.energy, 0, 5);
  user.needs_updated_at = now;
}

/** Pola potrzeb do zapisania w bazie. */
export function needsFields(user: User): Partial<User> {
  return {
    hunger: user.hunger,
    mood: user.mood,
    energy: user.energy,
    needs_updated_at: user.needs_updated_at,
    weight: user.weight,
    feeds_total: user.feeds_total,
  };
}

export function silhouette(user: User): string {
  if (user.weight < WEIGHT.thinBelow) return "chudzinka";
  if (user.weight > WEIGHT.chubbyAbove) return "pączek";
  return "w sam raz";
}

/** Pasek potrzeby, np. 🍖🍖🍖▫️▫️ */
function bar(value: number, icon: string): string {
  const full = Math.round(value);
  return icon.repeat(full) + "▫️".repeat(5 - full);
}

/** Krótka linijka z potrzebami (pod reakcjami na przyciski). */
export function needsLine(user: User): string {
  return `🍖 ${Math.round(user.hunger)}/5 · 💛 ${Math.round(user.mood)}/5 · ⚡ ${Math.round(user.energy)}/5`;
}

// ---------- Charakter ----------

export interface CharacterInfo {
  name: string; // nazwa wstawiana do persony
  accusative: string; // „wyrósł na …”
  emoji: string;
  trait: keyof Traits; // cecha, która prowadzi do tego charakteru
}

export const CHARACTERS: CharacterInfo[] = [
  { name: "Zgrywus", accusative: "Zgrywusa", emoji: "🃏", trait: "zarty" },
  { name: "Filozof", accusative: "Filozofa", emoji: "🌙", trait: "zycie" },
  { name: "Detektyw", accusative: "Detektywa", emoji: "🔍", trait: "zagadki" },
  { name: "Odkrywca", accusative: "Odkrywcę", emoji: "🧭", trait: "ciekawosc" },
  { name: "Sportowiec", accusative: "Sportowca", emoji: "🏃", trait: "sport" },
  { name: "Nieśmiałek", accusative: "Nieśmiałka", emoji: "☺️", trait: "lagodnosc" },
  { name: "Artysta", accusative: "Artystę", emoji: "🎨", trait: "sztuka" },
  { name: "Śpioch", accusative: "Śpiocha", emoji: "😴", trait: "pozne_pory" },
  { name: "Zrzęda", accusative: "Zrzędę", emoji: "🌧️", trait: "zaniedbanie" },
];

const TRAIT_LABELS: Record<keyof Traits, string> = {
  zarty: "żarty",
  zycie: "rozmowy o życiu",
  zagadki: "zagadki i pytania",
  ciekawosc: "ciekawość świata",
  sport: "ruch i sport",
  lagodnosc: "łagodność",
  sztuka: "pasje i sztuka",
  pozne_pory: "późne pory",
  zaniedbanie: "tęsknota",
};

/**
 * Wybiera charakter na podstawie cechy z największą liczbą punktów (remis = losowo).
 * Zrzęda (zaniedbanie) wygrywa tylko wtedy, gdy wyraźnie prowadzi – przy remisie wybieramy coś milszego.
 */
export function pickCharacter(traits: Traits): CharacterInfo {
  const max = Math.max(...CHARACTERS.map((c) => traits[c.trait]));
  const best = CHARACTERS.filter((c) => traits[c.trait] === max);
  const nice = best.filter((c) => c.trait !== "zaniedbanie");
  return pick(nice.length ? nice : best);
}

export function characterByName(name: string | null): CharacterInfo | undefined {
  return CHARACTERS.find((c) => c.name === name);
}

/** Dominująca cecha do tej pory (pokazywana w /stan, zanim charakter się ustali). */
function leadingTrait(traits: Traits): string | null {
  const entries = Object.entries(traits) as [keyof Traits, number][];
  const [key, value] = entries.sort((a, b) => b[1] - a[1])[0];
  return value > 0 ? TRAIT_LABELS[key] : null;
}

// ---------- Ewolucja ----------

/**
 * Sprawdza, czy zwierzak powinien przejść na nowy etap.
 * Jeśli tak: zapisuje zmianę, ustala charakter (gdy trzeba) i wysyła komunikat.
 * Zwraca true, gdy nastąpiła ewolucja.
 */
export async function evolveIfNeeded(env: Env, user: User, now = Date.now()): Promise<boolean> {
  if (user.status !== "active" || !user.born_at) return false;
  const target = stageForAge(ageDays(user, now));
  if (stageIndex(target.id) <= stageIndex(user.stage)) return false;

  const from = stageById(user.stage);
  const fields: Partial<User> = { stage: target.id };
  let character: CharacterInfo | undefined;
  if (!user.character && stageIndex(target.id) >= stageIndex(CHARACTER_STAGE)) {
    character = pickCharacter(parseTraits(user));
    fields.character = character.name;
  }
  await updateUser(env, user.chat_id, fields);
  Object.assign(user, fields);

  await sendMessage(env, user.chat_id, evolutionText(user, from, target, character));
  return true;
}

function evolutionText(user: User, from: Stage, to: Stage, character?: CharacterInfo): string {
  const name = user.pet_name ?? "Pyzio";
  const art = `✨ · ✨ · ✨\n\n    ${from.emoji}  ➜  ${to.emoji}\n\n✨ · ✨ · ✨`;
  let text: string;
  if (from.id === "jajko") {
    text = `*trzask!* 💥\n\n${art}\n\n${name} się wykluł! Teraz jest Maluchem. Zna dopiero kilka sylab, więc mów do niego dużo.`;
  } else {
    text = `${art}\n\n${name} urósł! Nowy etap: ${to.name}.`;
  }
  if (character) {
    text += `\n\n${character.emoji} Charakter się ukształtował: ${name} wyrósł na ${character.accusative}!`;
  }
  return text;
}

// ---------- Karta /stan ----------

export function statusCard(user: User): string {
  const stage = stageById(user.stage);
  const days = ageDays(user);
  const name = user.pet_name ?? "Pyzio";
  const character = characterByName(user.character);
  let charLine: string;
  if (character) {
    charLine = `${character.emoji} ${character.name}`;
  } else {
    const lead = leadingTrait(parseTraits(user));
    charLine = lead ? `jeszcze się kształtuje (na razie najwięcej: ${lead})` : "jeszcze się kształtuje";
  }
  return [
    `${stage.emoji}  ${name}`,
    "",
    `Etap: ${stage.name} (dzień ${days})`,
    `Charakter: ${charLine}`,
    `Sylwetka: ${silhouette(user)}`,
    "",
    `Sytość   ${bar(user.hunger, "🍖")} ${Math.round(user.hunger)}/5`,
    `Nastrój  ${bar(user.mood, "💛")} ${Math.round(user.mood)}/5`,
    `Energia  ${bar(user.energy, "⚡")} ${Math.round(user.energy)}/5`,
  ].join("\n");
}

// ---------- Jajko ----------

/** Odpowiedź jajka: dźwięk + postęp wykluwania (rysa → pęknięcie → wyłom → pół skorupki). */
export function eggReply(user: User, now = Date.now()): string {
  const hatchMs = (STAGES[1]?.fromDay ?? 1) * DAY_MS;
  const progress = (now - (user.born_at ?? now)) / hatchMs;
  if (progress < 0.25) {
    return pick(["*puk puk*", "*jajko się kołysze*", "*coś w środku cicho nuci*", "*jajko jest cieplutkie*"]);
  }
  if (progress < 0.5) {
    return pick(["*puk puk*", "*jajko się chwieje*"]) + "\nNa skorupce pojawiła się cienka rysa.";
  }
  if (progress < 0.75) {
    return pick(["*PUK PUK*", "*jajko podskakuje*"]) + "\nRysa zmieniła się w pęknięcie!";
  }
  if (progress < 0.9) {
    return pick(["*jajko trzęsie się jak galaretka*", "*chrup… chrup…*"]) + "\nW skorupce jest wyłom, coś zerka ze środka 👀";
  }
  return pick(["*PUK PUK PUK!*", "*jajko aż się turla*"]) + "\nPół skorupki już odpadło! To już zaraz…";
}

// ---------- Gotowe teksty w roli (bez AI) ----------

/** Grupa etapów: jajko / małe (maluch, dziecko) / duże (od nastolatka). */
export type Group = "egg" | "small" | "big";
export function stageGroup(user: User): Group {
  if (user.stage === "jajko") return "egg";
  if (user.stage === "maluch" || user.stage === "dziecko") return "small";
  return "big";
}

/** Po wyczerpaniu dziennego limitu wiadomości. */
export function sleepyLimitText(user: User): string {
  const g = stageGroup(user);
  if (g === "egg") return "*jajko zasnęło na dziś. Cichutko…* 💤";
  if (user.stage === "maluch") return "Ziew… pa pa… 💤";
  return withName("{imie} ziewa i zakopuje się w kocyk. Na dziś koniec gadania, pogadamy jutro! 💤", user);
}

/** Gdy AI nie odpowiada (limit, błąd). Nigdy nie pokazujemy technicznych komunikatów. */
export function aiErrorText(user: User): string {
  if (user.stage === "maluch") return "Ziiiew… pó-źniej… 💤";
  return withName(
    pick([
      "{imie} jest strasznie śpiący… pogadamy później!",
      "{imie} przysnął w połowie myśli… Napisz za chwilkę, dobrze?",
    ]),
    user,
  );
}

/** Jedno „tęsknię” po kilku dniach ciszy. Bez straszenia i bez poczucia winy. */
export function missYouText(user: User): string {
  const g = stageGroup(user);
  if (g === "egg") return "*jajko cichutko puka, jakby sprawdzało, czy jesteś w pobliżu*";
  if (user.stage === "maluch") return "Tę-sknię! 🥺";
  return withName(
    "Hej, tu {imie}. Trochę tęsknię! Jak znajdziesz chwilę, wpadnij pogadać. A jak masz teraz dużo na głowie, to spokojnie, poczekam 🙂",
    user,
  );
}

/** Poranek na etapie jajka (jajko nie mówi, więc bez AI). */
export function eggMorningText(): string {
  return pick(["*puk puk* (dzień dobry?)", "*jajko budzi się i lekko kołysze*"]);
}

/** Gdy ktoś wyśle zdjęcie, naklejkę itp. */
export function nonTextReply(user: User): string {
  if (stageGroup(user) === "egg") return "*jajko się kołysze*";
  if (user.stage === "maluch") return "Ooo? 👀";
  return withName("{imie} przekrzywia głowę. Na razie rozumie tylko literki!", user);
}

export type Action = "feed" | "play" | "sleep";

/**
 * Obsługa przycisków Nakarm / Pobaw się / Uśpij.
 * Zmienia potrzeby w obiekcie `user` i zwraca tekst reakcji.
 */
export function applyAction(user: User, action: Action): string {
  const g = stageGroup(user);
  let text: string;

  if (action === "feed") {
    const full = user.hunger >= 4.5;
    user.hunger = clamp(user.hunger + NEEDS.feed, 0, 5);
    user.weight = clamp(user.weight + (full ? WEIGHT.perOverfeed : WEIGHT.perFeed), 0, WEIGHT.max);
    user.feeds_total += 1;
    if (g === "egg") text = "Ogrzewasz jajko w dłoniach. *coś w środku mruczy z zadowolenia*";
    else if (full) text = g === "small" ? "Bęc… brzusio pełny!" : "Uff, już nie dam rady… ale dzięki 😅";
    else if (g === "small") text = pick(["Am am am! 😋", "Mniam mniam!", "Pyyycha!"]);
    else text = pick(["{imie} pałaszuje ze smakiem. Dzięki!", "Mniam. Tego było mi trzeba."]);
  } else if (action === "play") {
    const tired = user.energy < 1;
    if (!tired) {
      user.mood = clamp(user.mood + NEEDS.play, 0, 5);
      user.energy = clamp(user.energy - NEEDS.playEnergyCost, 0, 5);
    }
    if (g === "egg") text = "Turlasz jajko po kocyku. *jajko chyba chichocze*";
    else if (tired) text = g === "small" ? "Ziew… nie… mogę…" : "Chętnie, ale padam z nóg. Może najpierw drzemka?";
    else if (g === "small") text = pick(["Hihi! Jeszcze!", "Bawimy się! 🎾", "Łap łap!"]);
    else text = pick(["Ha, było super! Rewanż później?", "{imie} skacze dookoła. Dobra zabawa!"]);
  } else {
    const rested = user.energy >= 4.5;
    user.energy = clamp(user.energy + NEEDS.sleep, 0, 5);
    if (g === "egg") text = "Okrywasz jajko kocykiem. *cisza, tylko ciche tik-tak*";
    else if (rested) text = g === "small" ? "Nie chcę spać! …no dobra 💤" : "Ale ja wcale nie jestem śpiący! …no dobra, chwilka 💤";
    else if (g === "small") text = pick(["Lulu… 💤", "Dobranoc… 💤"]);
    else text = pick(["{imie} zwija się w kłębek i zasypia. 💤", "Krótka drzemka i wracam z nową energią 💤"]);
  }
  return withName(text, user);
}
