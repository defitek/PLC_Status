# PLC Commissioning Hub V2

Samodzielna aplikacja WWW do prowadzenia uruchomienia PLC. Działa na Node.js 24 i SQLite, bez zewnętrznych usług oraz bez zależności npm.

## Funkcje V2

- indywidualne konta i role: `admin`, `moderator`, `user`;
- dynamiczne sterowniki/obszary, kategorie, podkategorie, zmiany, typy notatek i wartości „Oczekiwanie na”;
- status z grupowaniem według kategorii, podkategorii lub statusu oraz filtrami kolumnowymi;
- zadania w trzech kolorystycznych etapach, z checklistami, terminami, autorem i powiązaniami;
- Cele łączące testy, zadania i otwarte punkty;
- otwarte punkty z terminem, przypomnieniem (domyślnie 14 dni), kategoriami i powiązaniem;
- dzienne notatki z zakresem dat (domyślnie 14 dni), grupowaniem i trzema typami powiązań;
- automatyczne pola „Utworzone przez” i „Data utworzenia”.

## Ważne przy aktualizacji z prototypu V1

V2 ma nowy model danych. Przy pierwszym starcie wykrywa bazę V1 i tworzy od nowa schemat V2 z przykładowymi danymi HB522/UB512. Kolejne redeploye zachowują już dane V2 na Railway Volume.

## Wdrożenie na Railway

Konfiguracja pozostaje taka sama jak w poprzedniej wersji:

1. Podmień wszystkie pliki w repozytorium GitHub zawartością katalogu `plc-commissioning-hub`.
2. Wypchnij commit do GitHuba; Railway powinien automatycznie rozpocząć deployment. Możesz też wybrać `Redeploy`.
3. Pozostaw Railway Volume zamontowany jako:

   ```text
   /app/data
   ```

4. Pozostaw zmienną:

   ```text
   DB_PATH=/app/data/plc-status.db
   ```

5. Ustaw dane pierwszego administratora:

   ```text
   APP_USER=admin
   APP_PASSWORD=ustaw-dlugie-losowe-haslo
   ```

6. Nie ustawiaj ręcznie `PORT`. Railway przekaże go automatycznie.

`Dockerfile` nie zawiera instrukcji `VOLUME`. Skrypt `docker-entrypoint.sh` po zamontowaniu dysku ustawia prawa do `/app/data`, a aplikacja działa jako użytkownik `node`. To zachowuje wcześniejszą poprawkę błędu SQLite `unable to open database file`.

Po pierwszym udanym uruchomieniu zaloguj się danymi `APP_USER` / `APP_PASSWORD`. Następne konta tworzysz w aplikacji w module **Konfiguracja → Użytkownicy**. Zmiana zmiennych `APP_USER` lub `APP_PASSWORD` po utworzeniu bazy nie zmienia istniejącego konta — hasło edytuje się w aplikacji.

## Uprawnienia w prototypie

| Czynność | Administrator | Moderator | Użytkownik |
|---|:---:|:---:|:---:|
| Dodawanie i edycja danych roboczych | ✓ | ✓ | ✓ |
| Usuwanie danych roboczych | ✓ | — | — |
| Kategorie, podkategorie i słowniki | pełne | dodawanie/edycja | — |
| Sterowniki i użytkownicy | pełne | podgląd | — |
| Ustawienie domyślnego przypomnienia | ✓ | — | — |

To jest wstępna macierz zgodna z założeniem, że dokładne uprawnienia zostaną dopasowane na końcu.

## Lokalny test przez Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Aplikacja: `http://localhost:8080`.

## Testy

W Node.js 24+:

```bash
npm test
```

## Dane i backup

Baza znajduje się w jednym pliku wskazanym przez `DB_PATH`. Na Railway jest to `/app/data/plc-status.db`. Nie usuwaj Volume i nie zmieniaj punktu montowania po rozpoczęciu właściwych testów. Przed ważną aktualizacją pobierz kopię pliku bazy lub wykonaj snapshot wolumenu.
