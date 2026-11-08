# Moduły aplikacji przeglądarkowej

- `../app.js` inicjalizuje aplikację i składa widoki funkcjonalne.
- `table-tools.js` obsługuje sortowanie, filtrowanie, widoczność kolumn oraz zapisane widoki tabel.

Moduły otrzymują stan i funkcje aplikacji przez jawnie przekazany obiekt zależności. Dzięki temu nie importują `app.js` i nie tworzą cykli zależności.
