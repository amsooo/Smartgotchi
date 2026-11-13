// =====================================================================
//  POMYSŁY NA ROZMOWĘ (przycisk „💡 O czym pogadać?” i komenda /temat)
//  Możesz tu dowolnie dopisywać, zmieniać i usuwać pomysły.
//
//  questions – pytania do kliknięcia. Kliknięte trafia od razu do zwierzaka,
//              jakby użytkownik sam je napisał. Trzymaj je krótkie
//              (do ok. 35 znaków), bo dłuższe nie mieszczą się na przycisku.
//  tell      – podpowiedzi, co można zwierzakowi opowiedzieć (tylko tekst,
//              użytkownik pisze sam). Dokańczają zdanie „Opowiedz mu…”.
// =====================================================================

export interface TopicSet {
  questions: string[];
  tell: string[];
}

export const TOPICS: Record<"egg" | "small" | "big", TopicSet> = {
  // Jajko – jeszcze nie mówi, ale „słyszy”
  egg: {
    questions: [
      "Hej, jest tam kto? 👀",
      "Kiedy się wyklujesz?",
      "Jak ci tam w środku?",
      "Śpisz?",
      "Słyszysz mnie?",
    ],
    tell: [
      "jak masz na imię",
      "jak minął Ci dzień",
      "jaka jest pogoda za oknem",
      "co będziecie razem robić, jak się wykluje",
    ],
  },

  // Maluch i dziecko – proste pytania, dużo zachwytu
  small: {
    questions: [
      "Lubisz ciasteczka?",
      "Co to jest chmura?",
      "Jaki kolor lubisz najbardziej?",
      "Umiesz liczyć do pięciu?",
      "Co ci się śniło?",
      "Pobawimy się w zgadywanki?",
      "Pamiętasz, jak mam na imię?",
      "Jaki dźwięk robi krowa?",
      "Czego się boisz?",
    ],
    tell: [
      "co dziś było najfajniejsze",
      "co widzisz teraz za oknem",
      "o swoim ulubionym jedzeniu",
      "o jakimś zwierzaku, którego znasz",
      "co było dziś na obiad",
    ],
  },

  // Nastolatek, młody dorosły, dorosły – prawdziwa rozmowa
  big: {
    questions: [
      "Gdzie byś pojechał, gdybyś mógł?",
      "Co cię ostatnio rozśmieszyło?",
      "Jaki byłby twój wymarzony dzień?",
      "Wymyśl dla mnie zagadkę!",
      "Jaką supermoc chciałbyś mieć?",
      "Masz radę na poniedziałki?",
      "Jaka piosenka do ciebie pasuje?",
      "Co byś zjadł, gdybyś mógł wszystko?",
      "Opowiedz mi coś o sobie",
      "Co myślisz o dzisiejszej pogodzie?",
    ],
    tell: [
      "co Cię dziś zaskoczyło",
      "o planach na weekend",
      "co Cię czeka jutro (potem sam dopyta, jak poszło!)",
      "o swoim hobby albo pasji",
      "o filmie, serialu albo książce, którą teraz poznajesz",
      "o czymś, co Cię ostatnio ucieszyło",
      "o osobie, z którą dziś rozmawiałeś lub rozmawiałaś",
    ],
  },
};
