# Moduły warstwy danych

- `../database.js` udostępnia publiczne repozytorium danych i zawiera reguły operacji wykonywanych przez API.
- `migrations.js` odpowiada za ewolucję schematu, dane początkowe i idempotentne uzupełnianie starszych baz.
- `security.js` zawiera walidację, haszowanie i weryfikację haseł.
- `constants.js` przechowuje mapowania współdzielone przez repozytorium i migracje.

Nowa migracja powinna trafić do `migrations.js`. Logika odczytu i zapisu wykonywana po uruchomieniu aplikacji pozostaje w repozytorium.
