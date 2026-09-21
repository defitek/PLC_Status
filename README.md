# PLC Commissioning Hub

Samodzielna aplikacja do prowadzenia statusu uruchomienia linii PLC. Zawiera cztery główne moduły:

- **Status** — testy, postęp, odpowiedzialni, milestone i krótkie notatki;
- **Zadania** — tablica „Do zrobienia / W toku / Zakończone”;
- **Otwarte punkty** — blokady, priorytety, wpływ, oczekiwanie i następny krok;
- **Dzienne notatki** — dziennik zmianowy z datą, zmianą, autorem i typem wpisu.

Przy pierwszym uruchomieniu baza jest automatycznie tworzona i uzupełniana przykładowymi danymi dla **HB522** oraz **UB512**.

## Najprostsze uruchomienie — Docker Compose

Wymagania: Docker oraz Docker Compose.

1. Rozpakuj paczkę na serwerze.
2. Opcjonalnie skopiuj `.env.example` jako `.env` i ustaw dane dostępu:

   ```env
   APP_USER=plc
   APP_PASSWORD=ustaw-dlugie-losowe-haslo
   ```

3. W katalogu aplikacji uruchom:

   ```bash
   docker compose up -d --build
   ```

4. Otwórz w przeglądarce:

   ```text
   http://ADRES_SERWERA:8080
   ```

Dane są przechowywane w trwałym wolumenie Docker `plc_status_data`, więc aktualizacja lub ponowne uruchomienie kontenera ich nie usuwa.

## Uruchomienie bez Dockera

Wymagany jest Node.js 24 lub nowszy.

```bash
node server.js
```

Aplikacja będzie dostępna pod adresem `http://localhost:3000`, a baza zostanie zapisana jako `data/plc-status.db`.

Można zmienić konfigurację przez zmienne środowiskowe:

| Zmienna | Znaczenie | Domyślna wartość |
|---|---|---|
| `PORT` | Port serwera HTTP | `3000` |
| `DB_PATH` | Ścieżka pliku SQLite | `data/plc-status.db` |
| `APP_USER` | Opcjonalny użytkownik HTTP Basic Auth | puste |
| `APP_PASSWORD` | Opcjonalne hasło HTTP Basic Auth | puste |

Jeżeli ustawiasz autoryzację, ustaw jednocześnie `APP_USER` i `APP_PASSWORD`.

## Kopia bezpieczeństwa

Baza jest pojedynczym plikiem SQLite. Przed wykonaniem kopii zatrzymaj zapis do aplikacji, a najlepiej kontener:

```bash
docker compose stop plc-status
```

Następnie wykonaj kopię wolumenu `plc_status_data` zgodnie z procedurą backupu używaną na Twoim serwerze i ponownie uruchom usługę:

```bash
docker compose start plc-status
```

## Bezpieczeństwo

- Do testu w odseparowanej sieci zakładowej można uruchomić aplikację bez logowania.
- Przed wystawieniem jej poza zaufaną sieć ustaw `APP_USER` i `APP_PASSWORD` oraz użyj HTTPS na reverse proxy (np. Nginx, Traefik lub firmowy load balancer).
- Wersja demonstracyjna nie ma indywidualnych kont ani rozbudowanych ról użytkowników.

## Struktura projektu

```text
plc-commissioning-hub/
├── public/              # interfejs przeglądarkowy
├── test/                # test warstwy danych
├── database.js          # obsługa SQLite i dane startowe
├── schema.sql           # struktura bazy i indeksy
├── server.js            # serwer HTTP oraz REST API
├── Dockerfile
└── compose.yaml
```

## Test

```bash
npm test
```

Projekt nie wymaga instalowania paczek npm — korzysta wyłącznie z modułów wbudowanych w Node.js 24.
