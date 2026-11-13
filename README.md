# 🐣 Smartgotchi – wersja testowa w Telegramie

Wirtualny zwierzak z AI w stylu Tamagotchi. Wykluwa się z jajka, rośnie, pamięta rozmowy, wie, jaka jest pogoda i pora dnia, a z czasem nabiera charakteru.

Ta wersja to **bot w Telegramie na test z 10–20 znajomymi przez ok. 2 tygodnie**. Test ma sprawdzić, czy ludzie sami wracają do zwierzaka.

Wszystko działa w darmowych planach: Cloudflare Workers, baza D1, Google Gemini i Open-Meteo.

---

## Spis treści

1. [Co będzie potrzebne](#1-co-będzie-potrzebne)
2. [Instalacja Node.js](#2-instalacja-nodejs)
3. [Pobranie projektu](#3-pobranie-projektu)
4. [Konto Cloudflare i logowanie](#4-konto-cloudflare-i-logowanie)
5. [Baza danych D1](#5-baza-danych-d1)
6. [Bot w Telegramie i Twoje ID](#6-bot-w-telegramie-i-twoje-id)
7. [Klucz Gemini](#7-klucz-gemini)
8. [Wdrożenie](#8-wdrożenie)
9. [Sekrety](#9-sekrety)
10. [Podpięcie webhooka](#10-podpięcie-webhooka)
11. [Sprawdzenie, że działa](#11-sprawdzenie-że-działa)
12. [Jak coś zmienić](#12-jak-coś-zmienić)
13. [Komendy testowe admina](#13-komendy-testowe-admina)
14. [Jak to działa w środku](#14-jak-to-działa-w-środku)
15. [Gdy coś nie działa](#15-gdy-coś-nie-działa)
16. [Lista kontrolna przed wysłaniem znajomym](#16-lista-kontrolna-przed-wysłaniem-znajomym)

---

## 1. Co będzie potrzebne

- komputer z Windows, macOS albo Linuxem,
- konto w Telegramie (aplikacja na telefonie wystarczy),
- konto Google (do klucza Gemini),
- ok. 30–45 minut.

Wszystkie komendy wpisujesz w **terminalu**:

- **Windows:** menu Start → wpisz „PowerShell” → Enter.
- **macOS:** Spotlight (⌘ + spacja) → „Terminal”.

## 2. Instalacja Node.js

1. Wejdź na <https://nodejs.org> i pobierz wersję **LTS**.
2. Zainstaluj ją, klikając „Dalej” i zostawiając domyślne opcje.
3. **Zamknij i otwórz terminal na nowo**, a potem sprawdź instalację:

   ```bash
   node -v
   npm -v
   ```

   Jeśli obie komendy pokażą numery wersji (np. `v22.x.x`), wszystko gra.

## 3. Pobranie projektu

**Sposób A, z Gitem:**

```bash
git clone https://github.com/amsooo/Smartgotchi.git
cd Smartgotchi
```

**Sposób B, bez Gita:** na stronie repozytorium w GitHubie kliknij zielony przycisk **Code → Download ZIP** i rozpakuj plik. Potem w terminalu przejdź do rozpakowanego folderu, np.:

```bash
cd Pobrane/Smartgotchi
```

Gdy jesteś już w folderze projektu, zainstaluj zależności:

```bash
npm install
```

> Wszystkie dalsze komendy wpisuj **w folderze projektu**.

## 4. Konto Cloudflare i logowanie

1. Załóż darmowe konto: <https://dash.cloudflare.com/sign-up>.
2. W terminalu wpisz:

   ```bash
   npx wrangler login
   ```

   Otworzy się przeglądarka. Kliknij **Allow**. W terminalu powinien pojawić się komunikat `Successfully logged in`.

## 5. Baza danych D1

1. Utwórz bazę:

   ```bash
   npx wrangler d1 create smartgotchi-db
   ```

   Jeśli wrangler zapyta, czy dopisać bazę do konfiguracji, odpowiedz **nie** (`n`), bo wpis już jest w `wrangler.toml`.
2. W odpowiedzi znajdziesz linijkę podobną do tej:

   ```
   "database_id": "1234abcd-5678-...."
   ```

3. Otwórz plik `wrangler.toml` w dowolnym edytorze (np. Notatniku albo VS Code) i podmień `WKLEJ-TUTAJ-SWOJE-DATABASE-ID` na swój identyfikator. Zapisz plik.
4. Utwórz tabele:

   ```bash
   npm run db:init
   ```

   Jeśli wrangler zapyta o potwierdzenie, wpisz `y`.

## 6. Bot w Telegramie i Twoje ID

**Token bota:**

1. W Telegramie znajdź **@BotFather** i napisz `/newbot`.
2. Podaj nazwę (np. `Smartgotchi`) i nazwę użytkownika zakończoną na `bot` (np. `MojSmartgotchiBot`).
3. BotFather przyśle **token**, czyli ciąg w stylu `7123456789:AAH...`. Zachowaj go dla siebie, bo to hasło do bota.

**Twoje ID (żeby bot wiedział, kto jest adminem):**

1. W Telegramie znajdź **@userinfobot** i napisz `/start`.
2. Odpowie liczbą `Id: 123456789`. To jest Twoje `ADMIN_CHAT_ID`.

## 7. Klucz Gemini

1. Wejdź na <https://aistudio.google.com/apikey> i zaloguj się kontem Google.
2. Kliknij **Create API key** i skopiuj klucz.

> ⚠️ W darmowym planie Google może wykorzystywać treści rozmów do ulepszania swoich usług. Dlatego bot ostrzega testerów na starcie, żeby nie pisali nic prywatnego.
>
> Model ustawiasz w `wrangler.toml` (`GEMINI_MODEL`). Domyślnie jest to `gemini-3.5-flash-lite`. Limity darmowego planu dla Twojego klucza sprawdzisz w AI Studio, w zakładce **Rate limits**. Gdyby model zniknął albo zmienił nazwę, aktualną listę znajdziesz tutaj: <https://ai.google.dev/gemini-api/docs/models>.

## 8. Wdrożenie

```bash
npm run deploy
```

Przy pierwszym wdrożeniu Cloudflare może poprosić o wybranie nazwy subdomeny `workers.dev`. Wybierz dowolną. Na końcu zobaczysz adres bota, np.:

```
https://smartgotchi.twoja-subdomena.workers.dev
```

**Zapisz ten adres**, przyda się za chwilę.

## 9. Sekrety

Sekrety to hasła i klucze, które nie mogą trafić do kodu. Każdą komendę wpisz osobno. Wrangler poprosi o wartość: wklej ją i naciśnij Enter. Podczas wklejania nic się nie wyświetla i tak ma być.

```bash
npx wrangler secret put TELEGRAM_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put ADMIN_CHAT_ID
npx wrangler secret put INVITE_CODE
```

Co gdzie wpisać:

| Sekret | Wartość |
|---|---|
| `TELEGRAM_TOKEN` | token od BotFathera |
| `TELEGRAM_WEBHOOK_SECRET` | **wymyśl** długie hasło (20+ znaków). Dozwolone są tylko litery, cyfry, `_` i `-`, np. `pyzio_tajne_haslo_2026_xyz` |
| `GEMINI_API_KEY` | klucz z AI Studio |
| `ADMIN_CHAT_ID` | Twoje ID od @userinfobot |
| `INVITE_CODE` | **wymyśl** kod zaproszenia: litery, cyfry, `_` lub `-`, bez spacji, np. `PYZIO2026` |

Sekrety działają od razu i nie trzeba ponownie wdrażać.

## 10. Podpięcie webhooka

Webhook mówi Telegramowi, gdzie ma wysyłać wiadomości do bota. Wklej w przeglądarkę ten adres, podmieniając dwie rzeczy:

```
https://smartgotchi.TWOJA-SUBDOMENA.workers.dev/setup?secret=TWOJ_TELEGRAM_WEBHOOK_SECRET
```

Strona powinna pokazać coś takiego:

```
✅ Webhook ustawiony na https://smartgotchi.twoja-subdomena.workers.dev/webhook
✅ Menu komend ustawione
✅ Bot: @MojSmartgotchiBot

Link z zaproszeniem dla znajomych:
https://t.me/MojSmartgotchiBot?start=PYZIO2026
```

**Ten ostatni link wysyłasz znajomym.** Bez kodu z linku bot nikogo nie wpuści. Wyjątkiem jesteś Ty jako admin: Tobie wystarczy samo `/start`.

<details>
<summary>Alternatywa: ręczne ustawienie przez API Telegrama</summary>

Wklej w przeglądarkę, podmieniając wartości:

```
https://api.telegram.org/botTWOJ_TOKEN/setWebhook?url=https://smartgotchi.TWOJA-SUBDOMENA.workers.dev/webhook&secret_token=TWOJ_TELEGRAM_WEBHOOK_SECRET&drop_pending_updates=true
```

Odpowiedź `{"ok":true,...}` oznacza sukces. Link z zaproszeniem złożysz wtedy sam: `https://t.me/NAZWA_BOTA?start=KOD`.
</details>

## 11. Sprawdzenie, że działa

1. Otwórz `https://smartgotchi.TWOJA-SUBDOMENA.workers.dev/`. Powinien pojawić się napis **„Smartgotchi działa 🐣”**.
2. Sprawdź webhook w Telegramie:

   ```
   https://api.telegram.org/botTWOJ_TOKEN/getWebhookInfo
   ```

   Pole `url` powinno wskazywać na Twój adres `/webhook`, a `last_error_message` powinno być puste.
3. Napisz do bota `/start`, nadaj imię, podaj miasto i pogadaj z jajkiem.
4. Napisz `/stats`, żeby zobaczyć statystyki (tylko admin).
5. Logi na żywo zobaczysz w osobnym oknie terminala:

   ```bash
   npm run logs
   ```

   Logi znajdziesz też w panelu Cloudflare: **Workers & Pages → smartgotchi → Logs**.

## 12. Jak coś zmienić

| Co | Gdzie | Potem |
|---|---|---|
| Osobowość, styl mówienia | `persona.md` | `npm run deploy` |
| Harmonogram etapów, limity, tempo potrzeb, godziny zadań | `src/config.ts` | `npm run deploy` |
| Model Gemini | `wrangler.toml` → `GEMINI_MODEL` | `npm run deploy` |
| Kod zaproszenia | `npx wrangler secret put INVITE_CODE` | nic |

W `persona.md` możesz używać tych pól (bot podmienia je na aktualne dane): `{imie}`, `{imie_uzytkownika}`, `{etap}`, `{charakter}`, `{sylwetka}`, `{glod}`, `{nastroj}`, `{energia}`, `{dzien_tygodnia}`, `{data}`, `{godzina}`, `{pogoda}`, `{swieto}`, `{pamiec}`, `{slowka}`.

Kod dodaje na końcu persony krótki blok „Uwagi techniczne”: wyjaśnia skalę potrzeb (5 = najedzony / wesoły / wypoczęty) i podaje długość odpowiedzi dla danego etapu. Długości zmieniasz w `src/config.ts` (`lengthHint`).

## 13. Komendy testowe admina

Działają tylko dla `ADMIN_CHAT_ID` i tylko na **Twoim** zwierzaku. Dzięki nim nie musisz czekać 2 tygodni, żeby zobaczyć ewolucję.

| Komenda | Co robi |
|---|---|
| `/stats` | statystyki testu (to samo przychodzi codziennie o 21:00) |
| `/test_przewin 3` | postarza zwierzaka o 3 dni (może wywołać ewolucję) |
| `/test_noc` | od razu robi nocne podsumowanie: notatka pamięci, słówka, cechy |
| `/test_rano` | od razu wysyła poranne zagadanie |

Admin domyślnie nie ma limitu 15 wiadomości (`adminUnlimited` w `src/config.ts`). Jeśli chcesz sprawdzić, jak działa limit, ustaw tam `false`.

## 14. Jak to działa w środku

```
Telegram ──webhook──▶ Cloudflare Worker ──▶ D1 (baza)
                           │
                           ├──▶ Gemini (odpowiedzi, poranki, nocne streszczenia)
                           └──▶ Open-Meteo (geokodowanie, pogoda)
Cron co 5 min ─────────────┘   (sprawdza godzinę polską i decyduje, co zrobić)
```

| Plik | Co zawiera |
|---|---|
| `src/index.ts` | punkt wejścia: webhook, `/setup`, cron |
| `src/handlers.ts` | komendy, zapis, rozmowa, przyciski |
| `src/chat.ts` | rozmowa z AI, poranek, nocne streszczenie |
| `src/cron.ts` | zadania okresowe |
| `src/pet.ts` | etapy, potrzeby, sylwetka, charakter, gotowe teksty |
| `src/persona.ts` | składanie promptu z `persona.md` |
| `src/config.ts` | **wszystkie ustawienia** |
| `src/stats.ts` | statystyki |
| `src/weather.ts`, `src/holidays.ts`, `src/time.ts` | pogoda, święta, czas polski |
| `src/db.ts`, `src/gemini.ts`, `src/telegram.ts` | baza, Gemini, Telegram |
| `schema.sql` | tabele w bazie |

Kilka ważnych zasad:

- **Czas letni i zimowy.** Cron chodzi co 5 minut w UTC, a kod za każdym razem sprawdza godzinę w Warszawie. Dzięki temu zmiana czasu niczego nie psuje.
- **Poranek (8:30–10:00).** Każdy tester ma inną, losową godzinę, stałą w danym dniu. Zagadanie dostają tylko osoby aktywne w ostatnich 3 dniach i tylko wtedy, gdy jeszcze tego dnia nie pisały. Kto milczy od 3 dni, dostaje jedno „tęsknię”, a potem cisza aż do jego powrotu.
- **Noc (3:00–6:00).** Streszczenie robione jest w paczkach po 8 osób, żeby nie przekroczyć limitów darmowych planów. Jeśli Gemini zawiedzie, następnej nocy bot streści dwa dni naraz.
- **Ewolucja.** Bot sprawdza ją przy każdej wiadomości i co 5 minut w dzień (8:00–22:00). Komunikat o ewolucji nie przyjdzie więc w środku nocy.
- **Jajko i przyciski nie zużywają Gemini.** Odpowiadają gotowymi tekstami i nie liczą się do limitu 15 wiadomości.
- **Potrzeby** spadają z czasem: sytość o 1 pkt co 4 h, nastrój co 5 h, energia co 6 h. Każda rozmowa poprawia nastrój. Zwierzak nigdy nie umiera.
- **Sylwetka.** Ok. 3 karmienia dziennie utrzymują sylwetkę „w sam raz”. Częściej daje „pączka”, rzadziej „chudzinkę”.
- **Charakter.** Każdej nocy AI przyznaje 0–3 pkt za żarty, rozmowy o życiu, zagadki, ciekawość, sport, łagodność i sztukę. Kod dolicza punkty za późne pory (pisanie 23:00–5:00) i zaniedbanie (dzień bez żadnego kontaktu). Na etapie „młody dorosły” wygrywa cecha z największą liczbą punktów. Zrzęda pojawia się tylko wtedy, gdy zaniedbanie wyraźnie prowadzi.
- **Prywatność.** Wiadomości są kasowane po 7 dniach, a długoterminowo zostaje tylko notatka pamięci. `/usun` kasuje wszystko o danej osobie.

## 15. Gdy coś nie działa

| Objaw | Co sprawdzić |
|---|---|
| Bot milczy | `getWebhookInfo` (punkt 11): czy jest `url` i czy nie ma błędu? Czy `npm run logs` coś pokazuje? |
| `last_error_message: Wrong response from the webhook: 403` | `TELEGRAM_WEBHOOK_SECRET` w Cloudflare różni się od tego w webhooku. Otwórz ponownie adres `/setup`. |
| Bot odpowiada tylko „…jest strasznie śpiący” | Gemini zwraca błąd. Napisz `/stats` i sprawdź licznik błędów, a w `npm run logs` zobaczysz szczegóły. Najczęstsze przyczyny to zły klucz, wyczerpany limit albo nieaktualna nazwa modelu. |
| `no such table: users` | Nie uruchomiono `npm run db:init` (punkt 5). |
| Znajomy dostaje „To zamknięta wersja testowa” | Napisał `/start` bez linku. Musi kliknąć link z kodem. |

---

## 16. Lista kontrolna przed wysłaniem znajomym

Przejdź ją samodzielnie na swoim koncie. Najlepiej zrób to też z drugiego konta Telegram (np. znajomego), bo admin ma kilka wyjątków.

**Zapis i bezpieczeństwo**
- [ ] `/start` **bez** kodu z drugiego konta → bot odmawia.
- [ ] Link z zaproszeniem → powitanie z ostrzeżeniem o AI i `/usun`.
- [ ] Imię: przycisk „Pyzio” działa, a własne imię też.
- [ ] Miasto: poprawne miasto zostaje znalezione, wymyślone daje prośbę o poprawkę, a „Pomiń” działa.

**Jajko i rozmowa**
- [ ] Jajko odpowiada tylko opisami w gwiazdkach.
- [ ] Przyciski Nakarm / Pobaw się / Uśpij zmieniają liczby, a `/stan` pokazuje obrazek, etap, potrzeby i charakter.
- [ ] `/test_przewin 1` → komunikat o wykluciu, a maluch mówi 1–4 słowami.
- [ ] `/test_przewin 2`, `3`, `4`… → kolejne etapy i sposób mówienia zmienia się z etapem.
- [ ] Zwierzak zna porę dnia i pogodę („jaka jest pogoda?”, „która godzina?”).
- [ ] Pytanie „jesteś AI?” → szczera odpowiedź w roli.
- [ ] Prośba o zadanie domowe → zwierzak się wykręca.
- [ ] Wiadomość o złym samopoczuciu → ciepła odpowiedź z numerem 116 123.
- [ ] Zdjęcie lub naklejka → krótka reakcja, bez błędu.

**Pamięć i zadania okresowe**
- [ ] Opowiedz coś o sobie (np. „w piątek mam rozmowę o pracę”) → `/test_noc` → notatka zawiera tę informację.
- [ ] `/test_rano` → poranna wiadomość nawiązuje do notatki.
- [ ] Następnego dnia rano zwierzak sam napisał między 8:30 a 10:00.
- [ ] O 21:00 przyszedł raport ze statystykami.

**Limity i błędy**
- [ ] Z drugiego konta wyślij 16 wiadomości → 16. kończy się „idzie spać”.
- [ ] Ustaw zły klucz (`npx wrangler secret put GEMINI_API_KEY` → byle co) → bot odpowiada w roli, a `/stats` pokazuje błąd. **Potem przywróć dobry klucz!**

**Usuwanie**
- [ ] `/usun` → „Nie” niczego nie usuwa, a „Tak” kasuje dane i `/stan` już nic nie pokazuje.

Gdy wszystko jest zaznaczone, wyślij znajomym link z zaproszeniem. Powodzenia! 🐣
