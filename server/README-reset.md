# Reset Danych

Ten dokument opisuje jak zresetować dane w bazie danych.

## Co zostanie usunięte

- ✅ **Użytkownicy** - wszystkie konta użytkowników
- ✅ **Gry** - wszystkie pokoje gier i sesje
- ✅ **Gracze w grach** - powiązania użytkowników z grami
- ✅ **Tokeny** - refresh tokeny i tokeny resetowania hasła
- ✅ **Sesje** - wszystkie aktywne sesje użytkowników

## Co zostanie zachowane

- ✅ **Mapy** - wszystkie mapy gier pozostaną nienaruszone

## Jak uruchomić reset

### Opcja 1: Przez npm script (zalecana)

```bash
cd server
npm run db:reset
```

### Opcja 2: Bezpośrednio

```bash
cd server
bun run src/db/reset-data.ts
```

## Ostrzeżenia

⚠️ **UWAGA**: Ta operacja jest nieodwracalna! Wszystkie dane użytkowników zostaną bezpowrotnie usunięte.

⚠️ **BACKUP**: Przed uruchomieniem resetu, jeśli chcesz zachować jakieś dane, zrób kopię zapasową bazy danych.

⚠️ **PRODUKCJA**: Nie uruchamiaj tego skryptu na produkcji!

## Po resecie

Po resecie danych:
1. Wszystkie użytkownicy będą musieli się zarejestrować ponownie
2. Wszystkie gry i pokoje zostaną wyczyszczone
3. Mapy pozostaną dostępne do tworzenia nowych gier
4. Można od razu zacząć korzystać z aplikacji

## Troubleshooting

Jeśli reset nie powiódł się:
1. Sprawdź czy baza danych jest dostępna
2. Sprawdź czy masz odpowiednie uprawnienia
3. Sprawdź logi błędów w konsoli
4. Upewnij się, że nie ma aktywnych połączeń do bazy danych 