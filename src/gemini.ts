// Rozmowa z Google Gemini (REST API, bez dodatkowych bibliotek).
import { incCounter } from "./db";
import type { Env } from "./types";

export interface GeminiTurn {
  role: "user" | "model";
  text: string;
}

/** Błąd Gemini – `status` 429 oznacza przekroczony limit darmowego planu. */
export class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface AskOptions {
  temperature?: number;
  maxOutputTokens?: number;
  jsonSchema?: Record<string, unknown>; // gdy podany: odpowiedź będzie w formacie JSON
}

/**
 * Wysyła prompt systemowy + historię rozmowy do Gemini i zwraca tekst odpowiedzi.
 * Rzuca GeminiError, gdy coś pójdzie nie tak.
 */
export async function askGemini(
  env: Env,
  systemPrompt: string,
  turns: GeminiTurn[],
  options: AskOptions = {},
): Promise<string> {
  // Gemini nie lubi dwóch wiadomości z rzędu od tej samej strony – sklejamy je.
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const t of turns) {
    if (!t.text.trim()) continue;
    const last = contents[contents.length - 1];
    if (last && last.role === t.role) last.parts[0].text += "\n" + t.text;
    else contents.push({ role: t.role, parts: [{ text: t.text }] });
  }
  // Rozmowa musi zaczynać się od użytkownika.
  while (contents.length && contents[0].role !== "user") contents.shift();
  if (contents.length === 0) throw new GeminiError(0, "Pusta rozmowa");

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.9,
      maxOutputTokens: options.maxOutputTokens ?? 1024,
      ...(options.jsonSchema
        ? { responseMimeType: "application/json", responseSchema: options.jsonSchema }
        : {}),
    },
  };

  await incCounter(env, "gemini");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = (await res.text().catch(() => "")).slice(0, 500);
    throw new GeminiError(res.status, `Gemini HTTP ${res.status}: ${errText}`);
  }

  const data: any = await res.json();
  const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
  // Pomijamy ewentualne „myśli” modelu, bierzemy tylko właściwą odpowiedź.
  const text = parts
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();

  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason ?? data?.promptFeedback?.blockReason ?? "brak";
    throw new GeminiError(200, `Gemini zwróciło pustą odpowiedź (powód: ${reason})`);
  }
  return text;
}
