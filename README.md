# PLC Commissioning Hub

Aktualna wersja aplikacji: **1.0.0**. Repozytorium utrzymuje jedną bieżącą wersję produktu.

Nazwy `migrateToV...` w `database.js` są wewnętrznymi, idempotentnymi migracjami schematu SQLite. Nie są osobnymi wersjami aplikacji i pozostają w kodzie wyłącznie po to, aby istniejący wolumen Railway został bezpiecznie zaktualizowany bez utraty danych.

## Zakres aplikacji

- Overview gotowości projektu i hierarchii obszarów;
- Status, Zadania, Otwarte punkty, Cele i Przekazanie statusu;
- graficzne zależności i kolejki pracy;
- Planner, Kalendarz, zapotrzebowanie manpoweru, nieobecności i kolizje projektów;
- Informator, powiadomienia i automatyzacje;
- kampanie testowe, bramy gotowości, odprawy, baza wiedzy i oceny miesięczne;
- role projektowe, blokady edycji, historia zmian i zapisane widoki;
- szyfrowane lokalnie backupy projektów.

## Wymagania

- Node.js 24 lub nowszy z `node:sqlite`;
- trwały katalog dla pliku SQLite;
- Redis dla trwałych sesji i wspólnego limitera logowania przy wielu replikach;
- HTTPS w środowisku produkcyjnym.

## Uruchomienie lokalne

```bash
npm ci
APP_USER=admin \
APP_PASSWORD=ustaw-dlugie-losowe-haslo \
MFA_ENCRYPTION_KEY=$(openssl rand -hex 32) \
DB_PATH=./data/plc-status.db \
SEED_DEMO_DATA=false \
npm start
```

Przy pierwszym uruchomieniu produkcyjnym `APP_PASSWORD` jest wymagane. Aplikacja nie tworzy produkcyjnego administratora z domyślnym hasłem.

## Railway

Repozytorium zawiera `Dockerfile`. Usługa nasłuchuje na wartości `PORT` dostarczonej przez Railway.

Ustaw zmienne:

```text
DB_PATH=/app/data/plc-status.db
APP_USER=admin
APP_PASSWORD=<długie losowe hasło pierwszego administratora>
MFA_ENCRYPTION_KEY=<64 znaki hex wygenerowane przez openssl rand -hex 32>
SEED_DEMO_DATA=false
REDIS_URL=<adres prywatny usługi Redis Railway>
```

Podłącz Railway Volume do `/app/data`. SQLite powinien pracować na jednej replice aplikacji. `REDIS_URL` zachowuje sesje po restarcie i pozwala bezpiecznie współdzielić sesje oraz limiter logowania; przy wielu replikach pozostaje wymagany, ale sama baza danych powinna wtedy zostać przeniesiona z SQLite do serwera SQL.

`MFA_ENCRYPTION_KEY` szyfruje sekrety MFA w bazie. Klucza nie należy zmieniać po włączeniu MFA użytkownikom, ponieważ istniejące sekrety przestaną być możliwe do odszyfrowania.

Endpoint kontrolny:

```text
GET /api/health
```

zwraca wydanie `1.0.0` oraz aktywny typ magazynu sesji.

## Bezpieczeństwo

- sesje mają ciasteczka `HttpOnly`, `SameSite=Lax` i `Secure` pod HTTPS;
- Redis może przechowywać sesje oraz liczniki nieudanych logowań między restartami;
- MFA TOTP można włączyć w nagłówku przez **Bezpieczeństwo**;
- administrator systemu ma dostęp do dziennika logowań, MFA, resetów haseł i zmian dostępu;
- dane użytkowników, Plannera i rekordy są filtrowane po bieżącym projekcie oraz roli;
- nagłówki CSP, HSTS, `frame-ancestors` i `nosniff` są ustawiane przez aplikację;
- błędy serwera nie ujawniają SQL ani wewnętrznych ścieżek;
- backup pobierany w interfejsie jest szyfrowany AES-GCM kluczem wyprowadzanym z hasła w przeglądarce. Hasło backupu nie jest wysyłane na serwer.

## Backup i przywracanie

Przed zmianą infrastruktury wykonaj snapshot Railway Volume. Backup projektu z interfejsu jest dodatkową kopią logiczną. Pliki `.plcbak` wymagają hasła ustawionego przy eksporcie; aplikacja nadal potrafi odtworzyć wcześniejsze, nieszyfrowane pliki JSON.

## Testy

```bash
npm test
```

Testy obejmują tworzenie i migrację bazy, izolację projektów, role API, sesje, ochronę danych, Planner, backup/restore, zależności i główne przepływy funkcjonalne.
