# PLC Commissioning Hub V11.0.0

Samodzielna aplikacja WWW do zarządzania uruchomieniem PLC, zespołem i kilkoma projektami. Działa na Node.js 24 oraz SQLite, bez zewnętrznych usług i bez zależności npm.

## Najważniejsze zmiany V11

V11 usprawnia codzienną pracę z dużymi listami i planowaniem zespołu, zachowując dotychczasową konfigurację Railway:

- projektowe ustawienie widoczności użytkownika na listach wyboru; nowe konta są domyślnie widoczne;
- wielokrotny wybór we wszystkich słownikowych filtrach Statusu, Zadań i Otwartych punktów;
- hierarchiczny filtr PLC, w którym wybór obszaru obejmuje wszystkie sterowniki potomne;
- zakresowe filtrowanie postępu oraz dat Start/Deadline;
- automatyczne ukrywanie kolumny, po której aktualnie pogrupowano tabelę;
- ręczne godziny pracy od–do oraz korekta narastającego salda nadgodzin bez mnożnika i z mnożnikiem;
- kopiowanie dnia Plannera razem z urlopem lub wolnym i import świąt w formacie `DD.MM.RRRR Nazwa święta`;
- czytelny edytor pełnej listy elementów i podkategorii grup funkcyjnych;
- uporządkowany dwupanelowy edytor kategorii oraz kompaktowy wybór zakresu podsumowania;
- schemat bazy oraz backup projektu w wersji `11.0`.

## Poprzednie zmiany V10

V10 rozwija współpracę wielu użytkowników i porządkuje interfejs operacyjny, zachowując dotychczasową konfigurację Railway. Najważniejsze zmiany:

- aktualizacje na żywo przez Server-Sent Events z automatycznym trybem awaryjnego odświeżania;
- ochrona przed nadpisaniem rekordu zmienionego równolegle przez inną osobę;
- samodzielna zmiana hasła oraz reset hasła przez administratora systemu;
- etykiety i konfigurowalne poziomy ważności Informatora, filtrowanie oraz potwierdzenia wyłącznie od wskazanych odbiorców;
- notatki dzienne przypisywane do całego projektu, obszaru, podobszaru albo sterownika;
- konfigurowalne normy czasu pracy, szybki import świąt, korekty godzin oraz narastające nadgodziny bez mnożnika i z mnożnikiem;
- poziomy zapotrzebowania kadrowego przedstawione w poziomym kalendarzu;
- kompaktowe edytory kategorii i grup funkcyjnych, poprawiony mobilny panel nawigacji i formularz logowania;
- usunięte automatyczne mini-podglądy po najechaniu na Status, Zadania i Otwarte punkty; szczegóły otwierają się dopiero po świadomym kliknięciu;
- schemat bazy oraz backup projektu w wersji `10.0`.

## Poprzednie zmiany V9

Wydanie V9 zachowuje konfigurację Railway z poprzedniej paczki i domyka funkcje operacyjne: responsywny interfejs, powiadomienia, komentarze, bezpieczne duplikowanie, zakresy Kalendarza, zapotrzebowanie kadrowe oraz kalkulację czasu pracy.

### Skrót zmian V9

- nieruchomy górny pasek i menu boczne na komputerze; przewijana jest wyłącznie powierzchnia robocza, a telefon i tablet korzystają z wysuwanego menu i dopasowanych okien;
- techniczna rola `moderator` jest prezentowana w interfejsie jako **Manager projektu**;
- Status, Zadania i Otwarte punkty otrzymały w V9 podgląd po najechaniu, menu prawego przycisku i bezpieczne duplikowanie; w V10 podgląd po najechaniu został usunięty, a pozostałe funkcje zachowane;
- Status, Zadania, Otwarte punkty i Cele obsługują komentarze, a historia edycji jest domyślnie zwinięta i dostępna na dole formularza;
- przypisanie zadania oraz komentarz generują powiadomienie w aplikacji i są priorytetowo pokazywane w dziennym podsumowaniu zmian;
- Informator wysyła powiadomienia wszystkim użytkownikom projektu, zbiera potwierdzenia przeczytania i pokazuje pięć ostatnich wiadomości w przewijanym pasku;
- lista kontrolna zadania została skompresowana; z karty otwiera ją przycisk `wykonane/wszystkie punktów kontroli`;
- Kalendarz pokazuje zadania tylko wtedy, gdy mają zarówno planowany start, jak i deadline; element wielodniowy jest jednym rozciągniętym paskiem, a adnotacja ma datę od–do;
- Status pozwala na powtarzające się nazwy i zbiorcze utworzenie do 500 punktów; Szybką edycję można rozszerzyć na całe okno;
- Planner ma kalendarz zapotrzebowania ON/OFF, święta, urlopy, wolne z nadgodzin oraz osobny raport godzin i nadgodzin dostępny Managerowi projektu i administratorom;
- konfiguracja zawiera uporządkowaną listę „Wymagania do spełnienia”; wiele wymagań można przypisać do Statusu, Zadania lub Otwartego punktu oraz filtrować po nich;
- szczegółowe KPI pokazują etykietę dnia/tygodnia/miesiąca i wartość procentową;
- poprawiono obsługę kliknięcia poza popupem: przeciągnięcie rozpoczęte wewnątrz okna nie zamyka go;
- backup projektu obejmuje komentarze, powiadomienia, potwierdzenia Informatora, wymagania, święta i nieobecności; schemat bazy ma wersję `9.0`.

## Funkcje bazowe zachowane z V8

Wydanie V8 rozwinęło Overview, Informator oraz operacyjne planowanie zapotrzebowania zespołu. Wszystkie poniższe funkcje pozostają dostępne w V9.

### Skrót funkcji V8

- Overview pokazuje przy zakresie „Cały projekt” zagregowane główne obszary, liczbę wszystkich, otwartych i zamkniętych pozycji oraz przełączany widok sterowników;
- trend KPI znajduje się bezpośrednio pod realizacją, a „Szczegółowe KPI” otwiera rozwijalne drzewo obszarów, podobszarów i sterowników dla dni, tygodni albo miesięcy;
- Planner używa jednej tabeli dla pracy `ON · fabryka` i `OFF · biuro`, obsługuje drag & drop, kopiowanie aktywności na zakres do 31 dni oraz tymczasowe dopisanie osoby wyłącznie na dzisiaj;
- administrator projektu i administrator systemu mogą definiować zapotrzebowanie ON/OFF per obszar i dzień; braki obsady są wyróżniane w podsumowaniu;
- nowy moduł Informator pozwala publikować wiadomości dla projektu lub wybranych obszarów, wskazywać osoby i przypinać elementy wszystkich modułów; pięć ostatnich wiadomości trafia na górny pasek;
- panel Konfiguracja jest ekranem skrótów, a wszystkie grupy ustawień otwierają się w osobnych popupach, które pozostają otwarte po zapisie;
- edytor hierarchii został przebudowany na zwarte drzewo z panelem szczegółów i operacjami zależnymi od wybranego poziomu;
- cele można edytować kliknięciem tła karty, adnotacje Kalendarza można usuwać z edycji i menu prawego przycisku;
- usunięto pole Milestone ze Statusu, ponieważ funkcję kamieni milowych realizuje moduł Cele;
- formularz zadania ma uporządkowaną kolejność tytuł/zakres/opis/link oraz jednolite wizualnie pola checklisty;
- ujednolicono skalę typografii i zagęszczono powierzchnie robocze bez utraty czytelności;
- backup projektu obejmuje również Informator i zapotrzebowanie Plannera; schemat bazy został podniesiony do `8.0`.

## Funkcje bazowe zachowane z V7

Wydanie V7 rozwija poprzednią wersję bez zmiany konfiguracji Railway. Poprawia identyfikację sterowników według pełnej hierarchii, czytelność historii zmian i usuwanie projektów. Dodaje zadania dla całych obszarów, szczegółowy Overview, dzienne zestawienie obsady per obszar oraz indywidualną konfigurację źródła danych w „Moim podsumowaniu”.

### Skrót funkcji V7

- pełna ścieżka `projekt → obszar → podobszar → sterownik`; techniczny identyfikator liścia ma postać np. `UB-UB51-SPS1`, a użytkownik nadal widzi przyjazne `UB51 SPS1`;
- dwa sterowniki mogą mieć tę samą nazwę liścia w różnych gałęziach, lecz duplikat w tej samej gałęzi jest blokowany;
- systemowe identyfikatory punktów nie są prezentowane użytkownikom w listach, oknach ani eksportach;
- dwustopniowo zabezpieczone usuwanie projektu, dostępne wyłącznie administratorowi systemu;
- indywidualnie przełączane źródło obszarów w „Moim podsumowaniu”: konfiguracja użytkownika albo Planner z najbliższych 14 dni;
- Planner z niezależnym włączaniem każdego aktywnego użytkownika, także administratora systemu, oraz jednym widokiem z oznaczeniami `ON · fabryka` i `OFF · biuro`;
- ostrzeżenie przy równoczesnym zaplanowaniu osoby online i offline oraz dzienna obsada online dla każdego głównego obszaru;
- zadania można przypisać do dowolnego poziomu hierarchii; dla obszaru powstaje automatyczna checklista wszystkich sterowników końcowych;
- ukończone zadania są domyślnie ukryte w widoku listy;
- historia checklist i złożonych pól pokazuje opis zmian, wykonawcę, wagę i stan zamiast surowego JSON;
- selektory powiązań są pogrupowane według hierarchii, pokazują nazwę sterownika na początku i blokują duplikaty;
- punkt Statusu można powiązać bezpośrednio z celem, a relacja jest widoczna z obu stron;
- Overview zawiera łączne i rozdzielone trendy Status/Zadania/Otwarte punkty/Cele oraz szczegóły kategorii i podkategorii Statusu;
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
- administrator projektu zarządza swoim projektem i rolami Manager projektu/użytkownik;
- projekt niedostępny dla użytkownika nie pojawia się na liście wyboru;
- istniejące dane są przypisane do projektu W371, a projekt W520 zawiera odrębne dane demonstracyjne;
- identyfikatory punktów są nadawane automatycznie, nie można ich edytować i pozostają ukryte w interfejsie.

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
- Manager projektu, administrator projektu i administrator systemu mogą przypisać na jeden dzień wiele obszarów, zmianę oraz `T` (transport) albo `T+P` (transport i praca); udział każdego konta w Plannerze jest włączany osobno przez administratora projektu lub systemu;
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

V11 automatycznie migruje bazy ze starszych wydań, nie kasując rekordów. Migracja zachowuje funkcje V10 oraz dodaje projektową widoczność użytkowników na listach wyboru i nowe pola ręcznej korekty czasu oraz salda nadgodzin. Dotychczasowe powiązania celów pozostają zsynchronizowane z relacjami pozostałych modułów.

Przed wdrożeniem produkcyjnym zalecany jest snapshot Railway Volume lub kopia pliku `/app/data/plc-status.db`. Po uruchomieniu V11 można też używać kopii projektowych w **Konfiguracja → Backup projektu**.

Jeśli w fazie koncepcyjnej potrzebny jest czysty start, usuń wyłącznie pliki:

```text
/app/data/plc-status.db
/app/data/plc-status.db-wal
/app/data/plc-status.db-shm
```

Następnie wykonaj redeploy. Nie usuwaj całego Volume, jeśli znajdują się na nim inne pliki.

## Uprawnienia prototypowe V11

| Czynność | Administrator systemu | Administrator projektu | Manager projektu | Użytkownik |
|---|:---:|:---:|:---:|:---:|
| Projekty i konta globalne | pełne | — | — | — |
| Role w projekcie | pełne | manager/użytkownik | — | — |
| Backup i odtwarzanie projektu | ✓ | ✓ | — | — |
| Sterowniki, hierarchia, grupy funkcyjne | pełne | pełne | podgląd | podgląd |
| Kategorie i słowniki | pełne | pełne | dodawanie/edycja/kolejność | podgląd |
| Planner — edycja planu | ✓ | ✓ | ✓ | — |
| Planner — zapotrzebowanie, święta i czas pracy | ✓ | ✓ | ✓ | — |
| Informator — publikowanie i edycja | ✓ | ✓ | ✓ | — |
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

Oczekiwany release: `11.0.0`.

## Testy automatyczne

W Node.js 24 lub nowszym:

```bash
npm test
```

Testy obejmują tworzenie nowej bazy, migracje, kolejność konfiguracji, grupy funkcyjne, izolację i zabezpieczone usuwanie projektów, pełne identyfikatory hierarchii, zadania obszarowe, backup/restore V11, wymagania do spełnienia, projektową widoczność użytkowników, bezpieczne duplikowanie, komentarze i powiadomienia, skierowane potwierdzenia Informatora, zakresy notatek, wielodniowy Kalendarz, urlopy, święta, ręczne godziny od–do, korekty salda i narastające nadgodziny, udział i zapotrzebowanie w Plannerze, ważone zadania, wieloosobowy Status, trendy KPI, dwukierunkowe powiązania z celami i podsumowanie dnia.
