-- Schemat bazy danych Smartgotchi (Cloudflare D1 / SQLite).
-- Uruchom raz: npm run db:init

-- Użytkownicy i ich zwierzaki (jeden użytkownik = jeden zwierzak)
CREATE TABLE IF NOT EXISTS users (
  chat_id           INTEGER PRIMARY KEY,           -- ID czatu w Telegramie
  first_name        TEXT,                          -- imię użytkownika z Telegrama
  status            TEXT NOT NULL DEFAULT 'ask_name', -- ask_name | ask_city | active
  pet_name          TEXT,
  city_name         TEXT,
  lat               REAL,
  lon               REAL,
  created_at        INTEGER NOT NULL,              -- kiedy kliknął /start (ms)
  born_at           INTEGER,                       -- kiedy dostał jajko (ms) – od tego liczymy wiek
  stage             TEXT NOT NULL DEFAULT 'jajko',
  character         TEXT,                          -- np. Zgrywus (od etapu „młody dorosły”)
  hunger            REAL NOT NULL DEFAULT 4,       -- sytość 0–5
  mood              REAL NOT NULL DEFAULT 4,       -- nastrój 0–5
  energy            REAL NOT NULL DEFAULT 4,       -- energia 0–5
  needs_updated_at  INTEGER,
  weight            REAL NOT NULL DEFAULT 8,       -- waga 0–20 → sylwetka
  feeds_total       INTEGER NOT NULL DEFAULT 0,
  memory            TEXT NOT NULL DEFAULT '',      -- notatka pamięci (max ok. 1500 znaków)
  phrases           TEXT NOT NULL DEFAULT '[]',    -- ulubione słówka użytkownika (JSON)
  traits            TEXT NOT NULL DEFAULT '{}',    -- punkty cech charakteru (JSON)
  last_user_msg_at  INTEGER,                       -- ostatnia wiadomość od użytkownika (ms)
  last_summary_at   INTEGER,                       -- do kiedy rozmowy są już streszczone (ms)
  last_night_date   TEXT,                          -- data ostatniego nocnego podsumowania
  last_morning_date TEXT,                          -- data ostatniej porannej wiadomości
  missed_sent       INTEGER NOT NULL DEFAULT 0     -- 1 = „tęsknię” już wysłane
);

-- Historia rozmów (stare wiadomości są kasowane po 7 dniach)
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id    INTEGER NOT NULL,
  role       TEXT NOT NULL,                        -- user | pet
  text       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages (chat_id, created_at);

-- Aktywność dzienna: limit wiadomości i statystyki
CREATE TABLE IF NOT EXISTS activity (
  chat_id  INTEGER NOT NULL,
  day      TEXT NOT NULL,                          -- data w czasie polskim, np. 2026-11-13
  messages INTEGER NOT NULL DEFAULT 0,
  buttons  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (chat_id, day)
);

-- Obsłużone aktualizacje Telegrama (ochrona przed duplikatami)
CREATE TABLE IF NOT EXISTS processed_updates (
  update_id  INTEGER PRIMARY KEY,
  created_at INTEGER NOT NULL
);

-- Pogoda w pamięci podręcznej (odświeżana co godzinę)
CREATE TABLE IF NOT EXISTS weather_cache (
  key        TEXT PRIMARY KEY,                     -- współrzędne miasta
  text       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Liczniki dzienne (np. zapytania do Gemini)
CREATE TABLE IF NOT EXISTS counters (
  day   TEXT NOT NULL,
  name  TEXT NOT NULL,
  value INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);

-- Log błędów
CREATE TABLE IF NOT EXISTS logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  day        TEXT NOT NULL,
  level      TEXT NOT NULL,
  chat_id    INTEGER,
  message    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_day ON logs (day);

-- Różne ustawienia (np. kiedy ostatnio wysłano raport)
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
