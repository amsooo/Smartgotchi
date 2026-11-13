// Polskie święta (ustawowe i te „zwyczajowe”, którymi zwierzak może się ekscytować).
import { addDays, daysBetween } from "./time";

/** Data Wielkanocy dla danego roku (algorytm Gaussa / Meeusa). Zwraca "RRRR-MM-DD". */
function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Lista świąt w danym roku: [data, nazwa]. */
function holidaysForYear(year: number): [string, string][] {
  const y = String(year);
  const e = easter(year);
  return [
    [`${y}-01-01`, "Nowy Rok"],
    [`${y}-01-06`, "Trzech Króli"],
    [`${y}-02-14`, "Walentynki"],
    [addDays(e, -52), "Tłusty Czwartek"],
    [`${y}-03-08`, "Dzień Kobiet"],
    [`${y}-04-01`, "Prima aprilis"],
    [e, "Wielkanoc"],
    [addDays(e, 1), "Poniedziałek Wielkanocny (śmigus-dyngus)"],
    [`${y}-05-01`, "Święto Pracy"],
    [`${y}-05-03`, "Święto Konstytucji 3 Maja"],
    [`${y}-05-26`, "Dzień Matki"],
    [addDays(e, 49), "Zielone Świątki"],
    [addDays(e, 60), "Boże Ciało"],
    [`${y}-06-01`, "Dzień Dziecka"],
    [`${y}-06-23`, "Dzień Ojca"],
    [`${y}-08-15`, "Wniebowzięcie NMP"],
    [`${y}-11-01`, "Wszystkich Świętych"],
    [`${y}-11-11`, "Święto Niepodległości"],
    [`${y}-11-29`, "Andrzejki"],
    [`${y}-12-06`, "Mikołajki"],
    [`${y}-12-24`, "Wigilia"],
    [`${y}-12-25`, "Boże Narodzenie"],
    [`${y}-12-26`, "drugi dzień świąt Bożego Narodzenia"],
    [`${y}-12-31`, "Sylwester"],
  ];
}

/**
 * Najbliższe święto w ciągu `withinDays` dni (licząc dziś).
 * Zwraca opis do persony albo tekst „brak”.
 */
export function nearestHoliday(today: string, withinDays = 3): string {
  const year = Number(today.slice(0, 4));
  const all = [...holidaysForYear(year), ...holidaysForYear(year + 1)];
  let best: { days: number; name: string } | null = null;
  for (const [date, name] of all) {
    const diff = daysBetween(today, date);
    if (diff >= 0 && diff <= withinDays && (!best || diff < best.days)) best = { days: diff, name };
  }
  if (!best) return "brak świąt w najbliższych dniach";
  if (best.days === 0) return `dziś: ${best.name}`;
  if (best.days === 1) return `jutro: ${best.name}`;
  return `${best.name} (za ${best.days} dni)`;
}
