# PLC Commissioning Hub V3

Samodzielna aplikacja WWW do prowadzenia dużego projektu uruchomienia PLC. Działa na Node.js 24 i SQLite, bez zewnętrznych usług i bez zależności npm.

## Najważniejsze funkcje V3

- konta i role `admin`, `moderator`, `user`;
- konfigurowalna kolejność sterowników, użytkowników, kategorii, podkategorii i słowników;
- główny **Overview** z liczbowym i procentowym stanem projektu oraz podziałem na sterowniki;
- **Moje podsumowanie** z zadaniami przypisanymi, utworzonymi, ogólnymi oraz elementami, w których wspomniano użytkownika;
- status z kolejnością zgodną z konfiguracją, grupowaniem, filtrami i sortowaniem każdej kolumny;
- tablica zadań z drag & drop oraz alternatywny widok listy z grupowaniem, filtrami i sortowaniem;
- osobne kategorie zadań, osoba odpowiedzialna wybierana z kont użytkowników, checklisty, terminy i czas trwania;
- powiązania zadań ze statusem, otwartym punktem albo dziennikiem;
- widok alertów dla przedawnionych i zbliżających się przypomnień otwartych punktów;
- cele z przejrzystą listą powiązań i osobnym oknem wyboru statusów, zadań i otwartych punktów;
- dzienne notatki z zakresem dat, calendar weeks (poniedziałek–niedziela), grupowaniem i nazwanymi typami powiązań;
- automatyczne pola autora i daty utworzenia w widoku szczegółowym;
- historia zmian statusu, zadania, otwartego punktu i notatki: użytkownik, dokładna data oraz zmienione pola;
- migracja istniejącej bazy V2 do V3 bez kasowania rekordów.

## Wdrożenie na Railway

Konfiguracja serwera pozostaje taka sama jak w poprzedniej wersji.

1. Rozpakuj paczkę i podmień zawartość repozytorium plikami z katalogu `plc-commissioning-hub`.
2. Wypchnij commit do GitHuba. Railway uruchomi deployment automatycznie; w razie potrzeby wybierz **Redeploy**.
3. Pozostaw Railway Volume zamontowany pod ścieżką:

   ```text
   /app/data
   ```

4. Pozostaw zmienną:

   ```text
   DB_PATH=/app/data/plc-status.db
   ```

5. Dla nowej bazy ustaw dane pierwszego administratora:

   ```text
   APP_USER=admin
   APP_PASSWORD=ustaw-dlugie-losowe-haslo
   ```

6. Nie ustawiaj ręcznie `PORT`. Railway przekaże go do kontenera automatycznie.

`Dockerfile` celowo nie deklaruje `VOLUME`. Skrypt `docker-entrypoint.sh` ustawia prawa do katalogu danych dopiero po zamontowaniu Railway Volume, a następnie uruchamia aplikację jako użytkownik `node`. Zachowuje to wcześniejszą poprawkę błędu SQLite `unable to open database file`.

Po wdrożeniu trzeba zalogować się ponownie, ponieważ sesje są przechowywane w pamięci procesu. Zmiana `APP_USER` albo `APP_PASSWORD` nie zmienia istniejącego konta; po utworzeniu bazy kontami zarządza się w **Konfiguracja → Użytkownicy**.

## Migracja i wariant czystego startu

Przy starcie V3 automatycznie dodaje nowe tabele i kolumny do istniejącej bazy V2. Rekordy pozostają zachowane, a dla danych historycznych tworzony jest pierwszy wpis migracyjny w historii zmian.

Jeżeli podczas fazy koncepcyjnej potrzebny jest całkowicie czysty start, usuń wyłącznie plik `/app/data/plc-status.db` (oraz ewentualne pliki `-wal` i `-shm`) z Railway Volume, a następnie wykonaj redeploy. Aplikacja utworzy nową bazę i dane demonstracyjne. Nie usuwaj całego Volume, jeśli znajdują się na nim inne potrzebne pliki.

## Uprawnienia prototypowe

| Czynność | Administrator | Moderator | Użytkownik |
|---|:---:|:---:|:---:|
| Dodawanie i edycja danych roboczych | ✓ | ✓ | ✓ |
| Zmiana sterownika w danych roboczych | ✓ | ✓ | ✓ |
| Usuwanie statusów, punktów i celów | ✓ | — | — |
| Usunięcie własnej notatki | ✓ | — | ✓ |
| Usunięcie własnego, niezmienionego przez innych zadania | ✓ | — | ✓ |
| Kategorie, podkategorie i słowniki | pełne | dodawanie, edycja, kolejność | — |
| Sterowniki i użytkownicy | pełne | podgląd | — |
| Ustawienia globalne przypomnień | ✓ | — | — |

Jest to nadal wstępna macierz, zgodna z ustaleniem, że szczegółowe uprawnienia zostaną dopracowane na końcu projektu.

## Lokalny test przez Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Aplikacja będzie dostępna pod `http://localhost:8080`.

## Testy

W Node.js 24 lub nowszym:

```bash
npm test
```

## Dane i kopie zapasowe

Baza jest pojedynczym plikiem wskazanym przez `DB_PATH`; na Railway jest to `/app/data/plc-status.db`. Przed istotną aktualizacją warto pobrać kopię pliku lub wykonać snapshot Railway Volume.
