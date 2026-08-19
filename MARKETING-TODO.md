# MARKETING & OPERATIONS TODO – MULTICORE Maksym Leski

Checklista działań marketingowych, wdrożeniowych i biznesowych, których nie można wykonać samym kodem:

---

## 1. 🏢 Dane Firmy i Prawne
- [ ] **NIP i dane rejestrowe:** Uzupełnić numer NIP w `site-config.js` (`company.nip`) po zarejestrowaniu/przygotowaniu wpisu CEIDG/KRS.
- [ ] **Weryfikacja modelu obsługi:** Potwierdzić czy firma obsługuje klientów wyłącznie wysyłkowo (door-to-door w całej Polsce), czy w przyszłości będzie dostępny stacjonarny punkt przyjęć w konkretnej miejscowości.
- [ ] **Polityka prywatności:** Zaktualizować adres do korespondencji w `polityka-prywatnosci.html`.

---

## 2. 📸 Prawdziwe Materiały Zdjęciowe i Wideo
- [ ] **Zdjęcie inżyniera / właściciela:** Wykonać profesjonalne, autentyczne zdjęcie Maksyma Leskiego przy stanowisku inżynierskim lub skanerze i umieścić w sekcji „O firmie”.
- [ ] **Zdjęcia procesu i sprzętu:** Dodać zdjęcia ze stanowiska pomiarowego (stoliki obrotowe, punkty referencyjne, skaner, wydruki z komory) zamiast grafik wektorowych/abstrakcyjnych.
- [ ] **Przemysłowe Case Study:** Dodać minimum 1-2 realizacje z sektora przemysłowego / utrzymania ruchu (np. zużyty wirnik pompy, koło zębate maszyny, regeneracja gniazda formierskiego) obok projektów motoryzacyjnych Datsun.
- [ ] **Wideo z automatyki:** Przygotować krótkie nagrania wideo przedstawiające działanie dedykowanych urządzeń, stanowisk testowych i robotów (Kawasaki / Siemens) na podstronie `automatyzacja.html`.

---

## 3. 🌐 Konfiguracja Domeny, SEO i Google
- [ ] **Google Search Console (GSC):**
  - Zweryfikować własność domeny `https://multicore.net.pl` (przez rekord DNS TXT lub plik HTML).
  - Zgłosić mapę witryny `https://multicore.net.pl/sitemap.xml`.
  - Sprawdzić indeksację stron głównych i podstron usługowych.
- [ ] **Google Business Profile (Wizytówka Google):**
  - Założyć lub zweryfikować profil firmy „MULTICORE Maksym Leski – Skanowanie 3D i Inżynieria Odwrotna”.
  - Zdefiniować obszar świadczenia usług (Cała Polska / model door-to-door).
  - Dodać aktualny numer telefonu (+48 533 491 374), adres strony (`https://multicore.net.pl`) i godziny kontaktu.
  - Opublikować pierwsze zdjęcia realizacji.

---

## 4. 📬 Konfiguracja Odbioru Formularza
- [ ] **Wybór endpointu formularza:**
  - W pliku `site-config.js` w polu `form.endpointUrl` ustawić docelowy endpoint (np. darmowy Web3Forms, Formspree, Cloudflare Worker lub własny skrypt PHP na serwerze).
  - Przeprowadzić test wysyłki formularza z załącznikiem (zdjęcie detalu JPG/PNG/PDF/STEP) i sprawdzić, czy powiadomienie e-mail trafia natychmiast na skrzynkę `kontakt@multicore.net.pl`.
- [ ] **Autoresponder:** Skonfigurować automatyczne potwierdzenie zwrotne wysyłane do klienta z informacją o przyjęciu zapytania.

---

## 5. ⭐️ Prawdziwe Opinie i Referencje Klientów
- [ ] **Zbieranie referencji:** Po zakończonych zleceniach zbierać autentyczne opinie od firm produkcyjnych, konstruktorów i właścicieli klasyków (zgodnie z zasadą: brak fikcyjnych opinii).
- [ ] **Publikacja referencji:** Dodać sekcję z referencjami i logotypami po uzyskaniu pisemnych zgód od kontrahentów.

---

## 6. 📊 Analityka i Śledzenie Konwersji
- [ ] **Google Analytics 4 / Google Tag Manager:**
  - Utworzyć strumień danych GA4 dla `multicore.net.pl`.
  - Zaimportować zdarzenia z warstwy `dataLayer`:
    - `primary_cta_clicked`
    - `phone_clicked`
    - `email_clicked`
    - `quote_form_started`
    - `quote_form_completed`
    - `calculator_started`
    - `calculator_completed`
    - `calculator_quote_sent`
    - `case_study_opened`
    - `embedded_inquiry_completed`
    - `automation_inquiry_completed`
  - Oznaczyć `quote_form_completed`, `phone_clicked` i `calculator_quote_sent` jako kluczowe konwersje (Key Events) w GA4.

---

## 7. 🌍 Wersja Językowa (Angielski)
- [ ] **Tłumaczenie techniczne:** W przypadku ekspansji na rynki zagraniczne (Niemcy, Skandynawia, UK) przygotować dedykowany katalog `/en/` z pełnym, profesjonalnym tłumaczeniem technicznym słownictwa inżynierskiego, atrybutami `hreflang` i osobną konfiguracją.
