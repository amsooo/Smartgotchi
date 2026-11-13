# 🐣 Smartgotchi – wersja testowa w Telegramie

Wirtualny zwierzak z AI w stylu Tamagotchi. Wykluwa się z jajka, rośnie, pamięta rozmowy, wie, jaka jest pogoda i pora dnia, a z czasem nabiera charakteru.

Ta wersja to **bot w Telegramie na test z 10–20 znajomymi przez ok. 2 tygodnie**. Test ma sprawdzić, czy ludzie sami wracają do zwierzaka.

Wszystko działa w darmowych planach: Cloudflare Workers, baza D1, Google Gemini i Open-Meteo.

**Całą instalację robisz w przeglądarce.** Nie musisz niczego instalować na komputerze ani używać terminala.

---

## Zanim zaczniesz

Przygotuj sobie (np. w notatniku):

- **token bota** od @BotFather,
- **klucz Gemini** z Google AI Studio,
- **swoje ID w Telegramie**: napisz `/start` do **@userinfobot**, a odpowie liczbą `Id: 123456789`,
- **wymyślone hasło do webhooka**: 20+ znaków, tylko litery, cyfry, `_` i `-`, np. `pyzio_tajne_haslo_2026_xyz`,
- **wymyślony kod zaproszenia**: litery, cyfry, `_` lub `-`, bez spacji, np. `PYZIO2026`.

Potrzebne jest też konto na GitHubie z dostępem do repozytorium `Smartgotchi` (już je masz).

Całość zajmuje ok. 20–30 minut.

---

## Krok 1. Konto Cloudflare

Załóż darmowe konto na <https://dash.cloudflare.com/sign-up> i potwierdź adres e-mail.

## Krok 2. Baza danych

1. W panelu Cloudflare kliknij w menu po lewej **Storage & Databases → D1 SQL Database**.
2. Kliknij **Create Database** (albo **Create**).
3. Jako nazwę wpisz dokładnie: `smartgotchi-db`. Lokalizację zostaw domyślną i kliknij **Create**.
4. Otworzy się strona bazy. Znajdź **Database ID** (ciąg w stylu `1234abcd-5678-...`) i **skopiuj go** do notatnika.

**Utworzenie tabel:**

1. Na stronie bazy otwórz zakładkę **Console**.
2. W repozytorium na GitHubie otwórz plik `schema.sql`. Kliknij ikonę **Copy raw file** (dwa kwadraciki w prawym górnym rogu pliku).
3. Wklej całość w okno konsoli i kliknij **Execute**.
4. Sprawdź wynik: w zakładce **Tables** powinno pojawić się 8 tabel, m.in. `users`, `messages` i `activity`.

> Jeśli konsola zgłosi błąd przy wklejeniu całości, wklejaj i wykonuj po jednym bloku `CREATE TABLE … ;` naraz.

## Krok 3. Wpisanie ID bazy w repozytorium

1. Na GitHubie otwórz w repozytorium plik `wrangler.toml`.
2. Kliknij ikonę ołówka ✏️ (**Edit this file**).
3. Znajdź linijkę:

   ```toml
   database_id = "WKLEJ-TUTAJ-SWOJE-DATABASE-ID"
   ```

   i podmień tekst w cudzysłowie na swoje Database ID z kroku 2. Cudzysłowy zostają.
4. Kliknij **Commit changes…**, a potem jeszcze raz **Commit changes**.

## Krok 4. Podpięcie repozytorium do Cloudflare

1. W panelu Cloudflare kliknij **Workers & Pages** (menu po lewej, czasem w sekcji **Compute**).
2. Kliknij **Create** (albo **Create application**), a potem **Import a repository**.
3. Wybierz **GitHub** i zaloguj się. GitHub zapyta, do których repozytoriów dać dostęp Cloudflare: wybierz **Only select repositories → Smartgotchi** i zatwierdź.
4. Wróć do Cloudflare i wybierz repozytorium **Smartgotchi**.
5. W ustawieniach projektu:
   - **Project name:** wpisz dokładnie `smartgotchi` (małymi literami). Nazwa musi zgadzać się z `wrangler.toml`, inaczej wdrożenie się nie uda.
   - **Build command:** zostaw puste.
   - **Deploy command:** zostaw domyślne `npx wrangler deploy`.
   - Gałąź zostaw tę, którą Cloudflare podpowie.
6. Kliknij **Create and deploy** (albo **Deploy**).

Cloudflare pobierze kod i go wdroży, co trwa 1–2 minuty. Przebieg widać na ekranie. Gdy pojawi się **Success**, przejdź dalej.

Na stronie Workera znajdziesz jego adres, np.:

```
https://smartgotchi.twoja-subdomena.workers.dev
```

**Skopiuj go do notatnika.**

> Od tej pory każda zmiana w repozytorium (np. edycja pliku na GitHubie) wdraża się automatycznie. Historię wdrożeń widać w zakładce **Deployments**.

## Krok 5. Sekrety

Sekrety to hasła i klucze, których nie zapisujemy w kodzie.

1. W **Workers & Pages** kliknij **smartgotchi**, a potem **Settings → Variables and Secrets**.
2. Kliknij **Add** i dodaj po kolei pięć wpisów. Przy każdym ustaw **Type: Secret**, nie „Text”.

   | Variable name | Value |
   |---|---|
   | `TELEGRAM_TOKEN` | token od @BotFather |
   | `TELEGRAM_WEBHOOK_SECRET` | wymyślone hasło do webhooka |
   | `GEMINI_API_KEY` | klucz Gemini |
   | `ADMIN_CHAT_ID` | Twoje ID w Telegramie |
   | `INVITE_CODE` | wymyślony kod zaproszenia |

3. Kliknij **Deploy** (albo **Save and deploy**).

> ⚠️ Typ **Secret** jest ważny. Zwykłe zmienne („Text”) znikają przy każdym automatycznym wdrożeniu z GitHuba, a sekrety zostają.
>
> Nazwy wpisuj dokładnie tak jak w tabeli, wielkimi literami. Pomyłka w jednej literze i bot nie zadziała.

## Krok 6. Podpięcie bota do Telegrama

Wklej w przeglądarkę ten adres, podmieniając dwie rzeczy (subdomenę i hasło do webhooka):

```
https://smartgotchi.TWOJA-SUBDOMENA.workers.dev/setup?secret=TWOJE_HASLO_DO_WEBHOOKA
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

## Krok 7. Sprawdzenie, że działa

1. Otwórz `https://smartgotchi.TWOJA-SUBDOMENA.workers.dev/`. Powinien pojawić się napis **„Smartgotchi działa 🐣”**.
2. Napisz do bota w Telegramie `/start`, nadaj imię, podaj miasto i pogadaj z jajkiem.
3. Napisz `/stats`. Admin powinien dostać statystyki.
4. Podgląd tego, co się dzieje, znajdziesz w **Workers & Pages → smartgotchi → Logs**. Tam widać też ewentualne błędy.

---

## Jak coś zmienić

Wszystko edytujesz na GitHubie: otwórz plik → ✏️ → zmień → **Commit changes**. Cloudflare sam wdroży nową wersję w 1–2 minuty.

| Co | Plik |
|---|---|
| Osobowość, styl mówienia | `persona.md` |
| Pomysły na rozmowę (przycisk „💡 O czym pogadać?”) | `src/topics.ts` |
| Harmonogram etapów, limity, tempo potrzeb, godziny zadań | `src/config.ts` |
| Model Gemini | `wrangler.toml` → `GEMINI_MODEL` |
| Kod zaproszenia | panel Cloudflare → Settings → Variables and Secrets → `INVITE_CODE` |

W `persona.md` możesz używać tych pól (bot podmienia je na aktualne dane): `{imie}`, `{imie_uzytkownika}`, `{etap}`, `{charakter}`, `{sylwetka}`, `{glod}`, `{nastroj}`, `{energia}`, `{dzien_tygodnia}`, `{data}`, `{godzina}`, `{pogoda}`, `{swieto}`, `{pamiec}`, `{slowka}`.

Kod dodaje na końcu persony krótki blok „Uwagi techniczne”: wyjaśnia skalę potrzeb (5 = najedzony / wesoły / wypoczęty) i podaje długość odpowiedzi dla danego etapu. Długości zmieniasz w `src/config.ts` (`lengthHint`).

Domyślny model to `gemini-3.5-flash-lite`. Limity darmowego planu dla swojego klucza sprawdzisz w Google AI Studio, w zakładce **Rate limits**. Gdyby model zniknął albo zmienił nazwę, aktualna lista jest tutaj: <https://ai.google.dev/gemini-api/docs/models>.

## Komendy testowe admina

Działają tylko dla `ADMIN_CHAT_ID` i tylko na **Twoim** zwierzaku. Dzięki nim nie musisz czekać 2 tygodni, żeby zobaczyć ewolucję.

| Komenda | Co robi |
|---|---|
| `/stats` | statystyki testu (to samo przychodzi codziennie o 21:00) |
| `/test_przewin 3` | postarza zwierzaka o 3 dni (może wywołać ewolucję) |
| `/test_noc` | od razu robi nocne podsumowanie: notatka pamięci, słówka, cechy |
| `/test_rano` | od razu wysyła poranne zagadanie |

Admin domyślnie nie ma limitu 15 wiadomości (`adminUnlimited` w `src/config.ts`). Jeśli chcesz sprawdzić, jak działa limit, ustaw tam `false`.

## Jak to działa w środku

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
| `src/topics.ts` | pomysły na rozmowę: pytania do kliknięcia i podpowiedzi |
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

## Gdy coś nie działa

| Objaw | Co sprawdzić |
|---|---|
| Wdrożenie w kroku 4 kończy się błędem | W zakładce **Deployments** kliknij nieudane wdrożenie i przeczytaj log. Najczęstsze przyczyny: nazwa projektu inna niż `smartgotchi` albo niepodmienione `database_id` w `wrangler.toml` (krok 3). |
| Strona `/setup` pokazuje „Zły sekret w adresie” | Hasło w adresie różni się od sekretu `TELEGRAM_WEBHOOK_SECRET`. |
| Strona `/setup` pokazuje błąd Telegrama | Sprawdź sekret `TELEGRAM_TOKEN`. |
| Bot milczy | Wklej w przeglądarkę `https://api.telegram.org/botTWOJ_TOKEN/getWebhookInfo`. Pole `url` powinno wskazywać na Twój `/webhook`, a `last_error_message` powinno być puste. Zajrzyj też do zakładki **Logs**. |
| `last_error_message: Wrong response from the webhook: 403` | Sekret `TELEGRAM_WEBHOOK_SECRET` zmienił się po podpięciu. Otwórz ponownie adres `/setup` z kroku 6. |
| Bot odpowiada tylko „…jest strasznie śpiący” | Gemini zwraca błąd. Napisz `/stats` i sprawdź licznik błędów, a szczegóły zobaczysz w **Logs**. Najczęstsze przyczyny to zły klucz, wyczerpany limit albo nieaktualna nazwa modelu. |
| W logach `no such table: users` | Tabele nie powstały. Powtórz krok 2 (Console + `schema.sql`). |
| Po zmianie na GitHubie bot „zgubił” klucze | Sekrety dodano jako „Text” zamiast „Secret”. Dodaj je ponownie jako **Secret** (krok 5). |
| Znajomy dostaje „To zamknięta wersja testowa” | Napisał `/start` bez linku. Musi kliknąć link z kodem. |

---

## Lista kontrolna przed wysłaniem znajomym

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
- [ ] Przycisk „💡 O czym pogadać?” (albo `/temat`) → pomysły pasujące do etapu, a kliknięte pytanie trafia do zwierzaka.

**Pamięć i zadania okresowe**
- [ ] Opowiedz coś o sobie (np. „w piątek mam rozmowę o pracę”) → `/test_noc` → notatka zawiera tę informację.
- [ ] `/test_rano` → poranna wiadomość nawiązuje do notatki.
- [ ] Następnego dnia rano zwierzak sam napisał między 8:30 a 10:00.
- [ ] O 21:00 przyszedł raport ze statystykami.

**Limity i błędy**
- [ ] Z drugiego konta wyślij 16 wiadomości → 16. kończy się „idzie spać”.
- [ ] W panelu zmień sekret `GEMINI_API_KEY` na byle co → bot odpowiada w roli, a `/stats` pokazuje błąd. **Potem przywróć dobry klucz!**

**Usuwanie**
- [ ] `/usun` → „Nie” niczego nie usuwa, a „Tak” kasuje dane i `/stan` już nic nie pokazuje.

Gdy wszystko jest zaznaczone, wyślij znajomym link z zaproszeniem. Powodzenia! 🐣

---

<details>
<summary>Dla zaawansowanych: instalacja z terminala</summary>

Jeśli kiedyś wolisz terminal (wymaga Node.js):

```bash
npm install
npx wrangler login
npx wrangler d1 create smartgotchi-db      # wklej database_id do wrangler.toml
npm run db:init
npm run deploy
npx wrangler secret put TELEGRAM_TOKEN     # i tak samo pozostałe 4 sekrety
npm run logs                               # logi na żywo
```
</details>
