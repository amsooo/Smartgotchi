// =====================================================================
//  KONFIGURACJA SMARTGOTCHI
//  Tutaj zmieniasz harmonogram etapów, limity i tempo potrzeb.
//  Po zmianie wystarczy ponownie wdrożyć: npm run deploy
// =====================================================================

/** Identyfikatory etapów (używane w bazie danych – nie zmieniaj ich nazw). */
export type StageId =
  | "jajko"
  | "maluch"
  | "dziecko"
  | "nastolatek"
  | "mlody_dorosly"
  | "dorosly";

export interface Stage {
  id: StageId;
  name: string; // nazwa pokazywana użytkownikowi i wstawiana do persony
  fromDay: number; // od którego dnia życia zaczyna się etap (dzień 0 = pierwsze 24 h)
  emoji: string; // „obrazek” zwierzaka na tym etapie
  lengthHint: string; // podpowiedź dla AI, jak długo ma odpowiadać
}

/**
 * HARMONOGRAM ETAPÓW (przyspieszony na czas testu).
 * Dzień liczymy w pełnych dobach od momentu, gdy użytkownik dostał jajko.
 * Dzień 0 = pierwsze 24 godziny = jajko.
 */
export const STAGES: Stage[] = [
  { id: "jajko", name: "Jajko", fromDay: 0, emoji: "🥚", lengthHint: "Nie mówisz, tylko krótki opis w gwiazdkach." },
  { id: "maluch", name: "Maluch", fromDay: 1, emoji: "🐣", lengthHint: "Odpowiadasz 1–4 słowami." },
  { id: "dziecko", name: "Dziecko", fromDay: 3, emoji: "🐥", lengthHint: "Odpowiadasz 1–2 krótkimi zdaniami." },
  { id: "nastolatek", name: "Nastolatek", fromDay: 6, emoji: "🐤", lengthHint: "Odpowiadasz 1–3 zdaniami." },
  { id: "mlody_dorosly", name: "Młody dorosły", fromDay: 10, emoji: "🐦", lengthHint: "Odpowiadasz 2–3 zdaniami." },
  { id: "dorosly", name: "Dorosły", fromDay: 14, emoji: "🦜", lengthHint: "Odpowiadasz maksymalnie 3–4 zdaniami." },
];

/** Etap, od którego zwierzak dostaje stały charakter. */
export const CHARACTER_STAGE: StageId = "mlody_dorosly";

/** Domyślne imię zwierzaka. */
export const DEFAULT_PET_NAME = "Pyzio";

/** Limity. */
export const LIMITS = {
  dailyMessages: 15, // ile wiadomości dziennie może wysłać jeden użytkownik
  adminUnlimited: true, // czy admin (ADMIN_CHAT_ID) ma limit wyłączony – wygodne przy testach
  historyMessages: 20, // ile ostatnich wiadomości idzie do AI jako kontekst
  maxUserMessageChars: 1000, // dłuższe wiadomości są przycinane
  memoryMaxChars: 1500, // maksymalna długość notatki pamięci
  inactiveDays: 3, // po ilu dniach ciszy zwierzak wysyła jedno „tęsknię”
  keepMessagesDays: 7, // po ilu dniach kasujemy stare wiadomości z bazy
  keepLogsDays: 14, // po ilu dniach kasujemy stare logi
};

/** Potrzeby (skala 0–5, gdzie 5 = w pełni zaspokojone). */
export const NEEDS = {
  start: { hunger: 4, mood: 4, energy: 4 },
  // co ile godzin dana potrzeba spada o 1 punkt
  hoursPerPoint: { hunger: 4, mood: 5, energy: 6 },
  feed: 2, // Nakarm: +2 do sytości
  play: 2, // Pobaw się: +2 do nastroju…
  playEnergyCost: 1, // …ale -1 do energii
  sleep: 3, // Uśpij: +3 do energii
  chatMood: 0.5, // każda wiadomość od użytkownika: +0,5 do nastroju
};

/**
 * Sylwetka zależy od „wagi” (0–20).
 * Każde karmienie dodaje wagę, każda noc trochę ją zmniejsza.
 * Ok. 3 karmienia dziennie = waga stoi w miejscu.
 */
export const WEIGHT = {
  start: 8,
  max: 20,
  perFeed: 1, // karmienie
  perOverfeed: 2, // karmienie, gdy zwierzak już jest najedzony
  nightlyLoss: 3, // ile wagi „spala” każdej nocy
  thinBelow: 4, // poniżej: chudzinka
  chubbyAbove: 14, // powyżej: pączek
};

/** Godziny zadań okresowych – czas polski (Europe/Warsaw). */
export const SCHEDULE = {
  morningFromMinute: 8 * 60 + 30, // 8:30 – najwcześniejsze poranne zagadanie
  morningToMinute: 10 * 60, // 10:00 – najpóźniejsze
  nightFromHour: 3, // nocne streszczenie od 3:00…
  nightToHour: 6, // …do 6:00 (w paczkach, żeby nie przekroczyć limitów)
  reportHour: 21, // raport dla admina o 21:00
  evolutionFromHour: 8, // komunikaty o ewolucji wysyłamy tylko w dzień…
  evolutionToHour: 22, // …żeby nie budzić ludzi w nocy
  batchSize: 8, // ilu użytkowników obsługujemy na jedno uruchomienie crona
};

export const TIMEZONE = "Europe/Warsaw";
