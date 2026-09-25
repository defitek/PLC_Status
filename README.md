# PLC Commissioning Hub V6.0.0

Samodzielna aplikacja WWW do zarządzania uruchomieniem PLC, zespołem i kilkoma projektami. Działa na Node.js 24 oraz SQLite, bez zewnętrznych usług i bez zależności npm.

## Najważniejsze zmiany V6

Wydanie V6 rozwija poprzednią wersję bez zmiany konfiguracji Railway. Porządkuje czteropoziomową hierarchię projektu, rozbudowuje Planner o tryb online/offline i operacje kopiowania, dodaje cele i priorytety do Kalendarza oraz umożliwia bezpieczne usuwanie projektów. Interfejs Plannera, zadań, Statusu, Historii i podsumowań został dodatkowo zagęszczony.

### Skrót zmian V6

- pełna ścieżka `projekt → obszar → podobszar → sterownik`; nazwa liścia jest prezentowana jako np. `UB51 PLC1`;
- dwustopniowo zabezpieczone usuwanie projektu, dostępne wyłącznie administratorowi systemu;
- przełączane źródło obszarów w „Moim podsumowaniu”: konfiguracja użytkownika albo Planner z najbliższych 14 dni;
- Planner bez administratorów systemu, z osobnymi sekcjami i statystykami `online · fabryka` oraz `offline · biuro`;
- kopiowanie pojedynczego przypisania lub całego dnia i wklejanie do innej osoby/daty z menu prawego przycisku;
- blokowanie duplikatów oraz jednoczesnego przypisania obszaru nadrzędnego i jego podobszaru;
- przypisywanie z Plannera zadań, Statusu i otwartych punktów do osoby;
- Kalendarz zawiera cele, filtry priorytetów, czytelny przełącznik „tylko moje” i menu prawego przycisku do dodawania lub wyboru elementów;
- Status pozwala przypisać wiele osób odpowiedzialnych, bez dawnego pola „Wspomniane osoby”;
- Overview pokazuje bezpośrednio trend KPI według hierarchii obszarów i sterowników;
- kompaktowe karty zadań z procentem i paskiem postępu oraz klikalne, zagęszczone wiersze Historii.

### Projekty, użytkownicy i uprawnienia

- środowisko wieloprojektowe z przełączaniem projektu po zalogowaniu i z górnego paska;
- użytkownicy globalni oraz niezależna rola i dostępność konta w każdym projekcie;
- role: `system_admin`, `project_admin`, `moderator`, `user`;
- administrator systemu zarządza projektami, kontami globalnymi oraz wszystkimi rolami;
- administrator projektu zarządza swoim projektem i rolami moderator/użytkownik;
- projekt niedostępny dla użytkownika nie pojawia się na liście wyboru;
- istniejące dane są przypisane do projektu W371, a projekt W520 zawiera odrębne dane demonstracyjne;
- identyfikatory punktów są nadawane automatycznie i nie można ich edytować.

### Wygląd i praca z oknami

- domyślny, nowy motyw niebiesko-biały;
- warianty ciemny, grafitowy, wysokiego kontrastu oraz klasyczny wygląd V3 jako backup;
- wybór motywu jest zapisany dla konta użytkownika;
- kliknięcie poza oknem zamyka je od razu, gdy nic nie zmieniono;
- przy niezapisanych zmianach pierwsze kliknięcie ostrzega, a drugie odrzuca zmiany i zamyka okno.

### Sterowniki i konfiguracja

- hierarchia ograniczona do czterech poziomów: projekt → obszar → podobszar → sterownik;
- wszystkie listy konfiguracji mają definiowaną kolejność;
- listy konfiguracyjne są prezentowane w kompaktowych, przewijanych panelach z możliwością otwarcia pełnego okna;
- grupy funkcyjne konfigurowane osobno dla każdego sterownika;
- grupy funkcyjne mają dowolną liczbę własnych podkategorii;
- każda grupa funkcyjna może mieć własne elementy, np. stacja `080VR_001` → `QM1`, `QM2`, `BZ1`;
- szybkie dodawanie grup i elementów przez wklejenie listy, jeden wiersz na pozycję;
- szablony punktów statusu z kategorią, wybranymi podkategoriami, elementem grupy i krytycznością;
- domyślna instrukcja „Test / funkcja” dla podkategorii, widoczna w szczegółach i podpowiedzi;
- duże okno szybkiej edycji statusu;
- konfigurowalne przypisanie pracowników do obszarów, wykorzystywane przez Planner i Moje podsumowanie.

### Overview i Moje podsumowanie

- kompaktowe KPI projektu bez dużych kafli, z klikalnymi listami elementów wymagających uwagi;
- zakres: cały projekt, wybrana grupa sterowników albo pojedynczy sterownik;
- poziomy trend procentowego wykonania oraz trend liczby wszystkich punktów na jednej osi czasu;
- wybór modułów uwzględnianych w trendzie KPI;
- zagęszczone porównanie obszarów z oznaczeniem ryzyka i trendem każdego obszaru;
- podział zarządczy według sterowników i alarmy dotyczące blokad, terminów oraz przypomnień;
- osobny moduł pracownika z pilnymi tematami, zadaniami przypisanymi bezpośrednio i pracą wynikającą z jego obszarów oraz planu.

### Planner, Kalendarz, Historia i podsumowanie dnia

- Planner manpoweru pokazuje aktywnych pracowników w wierszach i kolejne dni pogrupowane na tygodnie oraz miesiące;
- moderator, administrator projektu i administrator systemu mogą przypisać na jeden dzień wiele obszarów, zmianę oraz `T` (transport) albo `T+P` (transport i praca); administrator systemu nie jest pokazywany jako pracownik planowany;
- praca online na fabryce i offline w biurze jest grupowana i liczona osobno;
- menu prawego przycisku umożliwia kopiowanie wpisu/dnia oraz przypisanie pracy z istniejących zadań, Statusu i otwartych punktów;
- Planner pokazuje obciążenie zadaniami, otwartymi punktami, Statusem i notatkami oraz podsumowania liczby osób per obszar i zmiana;
- Kalendarz scala terminy ze Statusu, zadań i otwartych punktów z notatkami oraz adnotacjami koordynacyjnymi;
- dostępne są widoki dzień, tydzień, miesiąc i zakres własny do 31 dni oraz filtry typu danych, kategorii i „tylko moje”;
- moduł Historia pokazuje zmiany w Statusie, zadaniach, otwartych punktach i dzienniku z przejściem do rekordu;
- po wyborze projektu wyświetla się krótkie podsumowanie bieżącego dnia: tematy dodane, zamknięte, zmienione i usunięte;
- podsumowanie można ponownie otworzyć z górnego paska i wybrać zakres do 14 dni; listy są podzielone na moduły i prowadzą do istniejących rekordów.

### Status

- grupowanie w kolejności zdefiniowanej w konfiguracji;
- filtrowanie i sortowanie po kolumnach;
- grupa funkcyjna oraz opcjonalny element grupy;
- instrukcja testu w szczegółach i po wskazaniu kursorem;
- menu prawego przycisku umożliwia utworzenie zadania, otwartego punktu lub wpisu dziennika;
- wiele powiązań z zadaniami, otwartymi punktami i dziennikiem wraz z przejściem do elementu;
- osobny procent ukończenia prac powiązanych, niewliczany do bazowego postępu Statusu;
- historia każdej zmiany: użytkownik, dokładny czas i zmienione pola.

### Zadania

- tablica Kanban z przeciąganiem pomiędzy „Do zrobienia”, „W trakcie” i „Ukończone”;
- alternatywny widok listy z grupowaniem, filtrowaniem i sortowaniem;
- osobne kategorie i podkategorie zadań;
- wielu odpowiedzialnych wybieranych z listy aktywnych użytkowników projektu;
- każde podzadanie ma wagę i opcjonalnego wykonawcę; wykonawca podzadania jest automatycznie dopisywany do odpowiedzialnych za zadanie;
- postęp zadania jest obliczany jako średnia ważona wykonanych podzadań i przedstawiany procentowo oraz kolorystycznie;
- checklista, link/informacje dodatkowe, start, deadline i automatyczny czas pozostały;
- gdy brak deadline'u, czas trwania jest liczony od planowanego startu, a przy jego braku od utworzenia; przyszły start nie pokazuje czasu trwania;
- grupa funkcyjna + element albo ręczne pole „Inne” z wzajemnym blokowaniem pól;
- wiele powiązań ze Statusem, otwartymi punktami i dziennikiem wybieranych w przeszukiwanym i filtrowanym oknie;
- to samo powiązanie może wystąpić tylko raz, również gdy zostanie wskazane z drugiej strony relacji;
- autor, data utworzenia i pełna historia zmian w szczegółach;
- użytkownik może usunąć własne zadanie, jeśli nikt inny go nie zmieniał.

### Otwarte punkty, cele i dziennik

- sortowanie każdej kolumny i filtrowanie wszystkich informacji;
- widok przypomnień: przedawnione oraz zbliżające się w ciągu 7 dni;
- domyślne przypomnienie konfigurowalne przez administratora, startowo 14 dni;
- cele z czytelną listą elementów i osobnym selektorem Status/Zadania/Otwarte punkty;
- dziennik z filtrem i grupowaniem według calendar week (poniedziałek–niedziela);
- jedna, dowolnie rozszerzana lista jawnie opisanych powiązań w szczegółach notatki;
- autor i data utworzenia we wszystkich widokach szczegółowych;
- użytkownik może usunąć własną notatkę;
- historia zmian Statusu, zadania, otwartego punktu i notatki.

### Backup i eksporty

- administrator systemu lub projektu może pobrać backup bieżącego projektu jako JSON i odtworzyć go w konfiguracji;
- przywrócenie wymaga backupu o tym samym kodzie projektu i zastępuje dane tylko bieżącego projektu;
- eksport całego projektu do jednego pliku Excel: Podsumowanie, Status, Zadania, Cele, Otwarte punkty i Dziennik;
- eksport otwartych punktów dla wybranego zakresu, filtrów i sortowania;
- eksport Statusu według sterownika/grupy oraz na poziomie: sterowniki, kategorie, grupy funkcyjne lub pełne szczegóły;
- administrator może przygotować predefiniowane szablony eksportu Statusu;
- wszystkie arkusze używają wspólnego niebiesko-białego stylu, tabel, filtrów i zamrożonych nagłówków.

## Dane demonstracyjne

Przy pierwszym uruchomieniu aplikacja uzupełnia projekt W371 maksymalnie do wartości `DEMO_DATA_LIMIT` dla głównych modułów (maksymalnie 100). Powstają różne statusy, priorytety, terminy, przypomnienia, checklisty, autorzy, powiązania i historia. Projekt W520 otrzymuje odrębny, mniejszy zestaw testowy: 40 statusów, 35 zadań, 30 otwartych punktów, 30 notatek i 8 celów.

Generator jest idempotentny: restart albo redeploy nie tworzy duplikatów. Konta rozpoczynające się od `demo.` mają losowe, nieudostępniane hasła; administrator systemu może ustawić im nowe hasło.

## Wdrożenie na Railway

Konfiguracja serwera pozostaje zgodna z poprzednimi ustaleniami.

1. Rozpakuj paczkę. Jej katalog główny jest gotowy do użycia jako zawartość repozytorium.
2. Podmień pliki w repozytorium i wypchnij commit do GitHuba albo użyj ręcznego redeploy w Railway.
3. Zachowaj Railway Volume zamontowany dokładnie pod:

   ```text
   /app/data
   ```

4. Zachowaj zmienną:

   ```text
   DB_PATH=/app/data/plc-status.db
   ```

5. Dla zupełnie nowej bazy ustaw pierwszego administratora systemu:

   ```text
   APP_USER=admin
   APP_PASSWORD=ustaw-dlugie-losowe-haslo
   ```

6. Nie ustawiaj ręcznie `PORT`; Railway przekaże tę wartość do kontenera.
7. Opcjonalne ustawienia danych demonstracyjnych:

   ```text
   SEED_DEMO_DATA=true
   DEMO_DATA_LIMIT=100
   ```

`DEMO_DATA_LIMIT` jest ograniczany do 1–100. Dla bazy bez danych testowych ustaw `SEED_DEMO_DATA=false` jeszcze przed pierwszym uruchomieniem.

`Dockerfile` nie deklaruje `VOLUME`. `docker-entrypoint.sh` ustawia prawa katalogu po zamontowaniu Railway Volume i dopiero wtedy uruchamia aplikację jako użytkownik `node`. Zachowuje to wcześniejszą poprawkę błędu SQLite `unable to open database file`.

Po redeployu trzeba zalogować się ponownie, ponieważ sesje są przechowywane w pamięci procesu. `APP_USER` i `APP_PASSWORD` służą tylko do utworzenia pierwszego konta w nowej bazie; nie resetują istniejących danych logowania.

## Aktualizacja istniejącej bazy

V6 automatycznie migruje bazy ze starszych wydań, nie kasując rekordów. Dotychczasowe dane zostają przypisane do projektu W371, a istniejący administrator staje się administratorem systemu i projektu. Migracja dodaje między innymi tryb pracy Plannera, wieloosobowy Status, priorytety celów i ręczne umieszczanie istniejących elementów w Kalendarzu. Starsze powiązania są scalane do jednej kanonicznej relacji.

Przed wdrożeniem produkcyjnym zalecany jest snapshot Railway Volume lub kopia pliku `/app/data/plc-status.db`. Po uruchomieniu V6 można też używać kopii projektowych w **Konfiguracja → Backup projektu**.

Jeśli w fazie koncepcyjnej potrzebny jest czysty start, usuń wyłącznie pliki:

```text
/app/data/plc-status.db
/app/data/plc-status.db-wal
/app/data/plc-status.db-shm
```

Następnie wykonaj redeploy. Nie usuwaj całego Volume, jeśli znajdują się na nim inne pliki.

## Uprawnienia prototypowe V6

| Czynność | Administrator systemu | Administrator projektu | Moderator | Użytkownik |
|---|:---:|:---:|:---:|:---:|
| Projekty i konta globalne | pełne | — | — | — |
| Role w projekcie | pełne | moderator/użytkownik | — | — |
| Backup i odtwarzanie projektu | ✓ | ✓ | — | — |
| Sterowniki, hierarchia, grupy funkcyjne | pełne | pełne | podgląd | podgląd |
| Kategorie i słowniki | pełne | pełne | dodawanie/edycja/kolejność | podgląd |
| Planner — edycja planu | ✓ | ✓ | ✓ | — |
| Kalendarz — adnotacje koordynacyjne | ✓ | ✓ | ✓ | — |
| Dane robocze i zmiana sterownika | ✓ | ✓ | ✓ | ✓ |
| Usuwanie danych innych osób | ✓ | ✓ | — | — |
| Usuwanie własnej notatki | ✓ | ✓ | — | ✓ |
| Usuwanie własnego niezmienionego zadania | ✓ | ✓ | — | ✓ |

Jest to nadal wstępna macierz uprawnień, zgodnie z założeniem, że szczegółowe prawa zostaną dopracowane na końcu projektu.

## Test lokalny

```bash
cp .env.example .env
docker compose up -d --build
```

Aplikacja będzie dostępna pod `http://localhost:8080`.

Kontrola zdrowia i wersji:

```bash
curl http://localhost:8080/api/health
```

Oczekiwany release: `6.0.0`.

## Testy automatyczne

W Node.js 24 lub nowszym:

```bash
npm test
```

Testy obejmują tworzenie nowej bazy, migracje, kolejność konfiguracji, grupy funkcyjne, izolację i zabezpieczone usuwanie projektów, hierarchię, niezmienność ID, backup/restore, tryby Plannera, Kalendarz z celami, ważone zadania, wieloosobowy Status, kanoniczne powiązania i podsumowanie dnia.
