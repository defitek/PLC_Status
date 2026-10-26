# Struktura stylów

- `../styles.css` zawiera tokeny motywu, bazowe elementy interfejsu i komponenty współdzielone przez kilka modułów.
- `modules/meetings.css` zawiera cały wygląd odpraw: listę, edytor planu, podsumowanie i plan opublikowany w Informatorze.

Reguła modułowa powinna mieć jedną definicję bazową. Zmiany dla szerokości ekranu pozostają na końcu tego samego pliku. Selektor modułu nie powinien być ponownie definiowany w `styles.css`.
