# Testing Guide - Session Management

## Przegląd testów

Ten przewodnik opisuje jak przetestować nowo zaimplementowany system session management.

## 🚀 Uruchamianie systemu

### 1. Przygotowanie bazy danych
```bash
# W katalogu /workspace/server
bun run db:migrate
```

### 2. Uruchamianie serwerów
```bash
# Terminal 1: Game Server (WebSocket)
cd /workspace/game-server
bun run dev

# Terminal 2: HTTP Server (tRPC API)
cd /workspace/server  
bun run dev

# Terminal 3: Client (Frontend)
cd /workspace/client
bun run dev
```

## 🧪 Scenariusze testowe

### Test 1: Podstawowy Auth Flow
**Cel**: Weryfikacja JWT authentication w WebSocket

**Kroki**:
1. Otwórz http://localhost:5173
2. Zarejestruj nowe konto lub zaloguj się
3. Przejdź do lobby i utwórz nową grę
4. Dołącz do gry

**Oczekiwany rezultat**:
- Połączenie WebSocket z JWT tokenem
- Gracz pomyślnie dołącza do pokoju
- Logs pokazują weryfikację JWT

**Sprawdzenie**:
```bash
# W game-server logs powinno być:
🔐 Authenticating client: [sessionId]
✅ JWT verified for user: [username]
👤 Player joined: [username]
```

### Test 2: Game State Persistence
**Cel**: Weryfikacja zapisywania stanu gry do DB

**Kroki**:
1. Utwórz grę z 2+ graczami
2. Rozpocznij grę (wszyscy gracze ready)
3. Wykonaj kilka ruchów
4. Sprawdź bazę danych

**Oczekiwany rezultat**:
- Stan gry zapisany w tabeli `games.gameState`
- Kolumna `lastStateUpdate` aktualizowana
- Tabela `activeGameSessions` zawiera aktywne sesje

**Sprawdzenie**:
```sql
-- Sprawdź zapisany stan
SELECT gameState, lastStateUpdate FROM games WHERE id = '[gameId]';

-- Sprawdź aktywne sesje
SELECT * FROM activeGameSessions WHERE gameId = '[gameId]';
```

### Test 3: Reconnection - Normalne rozłączenie
**Cel**: Test reconnection po zamknięciu karty

**Kroki**:
1. Dołącz do gry
2. Zamknij kartę przeglądarki (Ctrl+W)
3. Otwórz ponownie w nowej karcie
4. Przejdź do tej samej gry

**Oczekiwany rezultat**:
- Gracz automatycznie reconnectuje
- Stan gry przywrócony
- Kontynuacja rozgrywki

**Sprawdzenie**:
```bash
# W client logs:
🔄 Reconnecting to game...
✅ Reconnected successfully!
```

### Test 4: Reconnection - Utrata połączenia
**Cel**: Test reconnection po utracie sieci

**Kroki**:
1. Dołącz do gry
2. Symuluj utratę połączenia (wyłącz WiFi na 5s)
3. Włącz ponownie połączenie

**Oczekiwany rezultat**:
- Automatyczne próby reconnection
- Powrót do gry po przywróceniu połączenia
- Zachowany stan gry

**Sprawdzenie**:
```bash
# W client logs:
👋 Left room with code: [nie 1000]
🔄 Attempting to reconnect...
✅ Reconnected successfully!
```

### Test 5: Game State Recovery
**Cel**: Test odtwarzania stanu po restarcie serwera

**Kroki**:
1. Utwórz grę i rozpocznij rozgrywkę
2. Wykonaj kilka ruchów
3. Zatrzymaj game-server (Ctrl+C)
4. Uruchom ponownie game-server
5. Spróbuj dołączyć do gry

**Oczekiwany rezultat**:
- Stan gry odtworzony z bazy danych
- Gracze mogą kontynuować rozgrywkę
- Zachowane pozycje jednostek i stan tury

**Sprawdzenie**:
```bash
# W game-server logs:
🔄 Deserializing game state from DB
✅ Game state restored successfully
```

### Test 6: Multiple Sessions
**Cel**: Test mapowania userId → roomId

**Kroki**:
1. Zaloguj się na to samo konto w 2 kartach
2. Dołącz do gry w pierwszej karcie
3. Spróbuj dołączyć w drugiej karcie

**Oczekiwany rezultat**:
- Druga sesja zastępuje pierwszą
- Pierwsza karta otrzymuje disconnect
- Aktualizacja w `activeGameSessions`

**Sprawdzenie**:
```sql
-- Powinna być tylko jedna aktywna sesja na użytkownika
SELECT COUNT(*) FROM activeGameSessions 
WHERE userId = '[userId]' AND isActive = true;
```

### Test 7: Turn-based State Sync
**Cel**: Test synchronizacji stanu między turami

**Kroki**:
1. Gra z 2 graczami
2. Gracz 1 wykonuje ruch
3. Gracz 1 kończy turę
4. Gracz 2 sprawdza stan

**Oczekiwany rezultat**:
- Stan zapisany po zakończeniu tury
- Gracz 2 widzi zaktualizowany stan
- Poprawna zmiana aktywnego gracza

**Sprawdzenie**:
```bash
# W game-server logs:
🔄 Turn advanced to: [player2]
💾 Game state saved to DB
```

### Test 8: Error Handling
**Cel**: Test obsługi błędów

**Kroki**:
1. Wyłącz bazę danych
2. Spróbuj dołączyć do gry
3. Włącz bazę danych
4. Spróbuj ponownie

**Oczekiwany rezultat**:
- Graceful error handling
- Informacyjne komunikaty błędów
- Automatyczne recovery po przywróceniu DB

**Sprawdzenie**:
```bash
# W game-server logs:
❌ Failed to save game state: [error]
❌ Failed to load game state: [error]
```

## 📊 Monitoring i Debugging

### Database Queries
```sql
-- Aktywne sesje
SELECT u.username, ags.sessionId, ags.lastActivity, ags.isActive
FROM activeGameSessions ags
JOIN users u ON ags.userId = u.id
WHERE ags.isActive = true;

-- Stan gier
SELECT id, status, phase, turnNumber, lastStateUpdate
FROM games
WHERE status = 'in_progress';

-- Gracze w grach
SELECT g.id as gameId, u.username, gp.isReady, gp.isActive
FROM games g
JOIN gamePlayers gp ON g.id = gp.gameId
JOIN users u ON gp.userId = u.id;
```

### Log Analysis
```bash
# Filtrowanie logów reconnection
grep -i "reconnect" game-server.log

# Błędy bazy danych
grep -i "failed to" game-server.log

# Statystyki JWT
grep -i "jwt" game-server.log | wc -l
```

## ✅ Kryteria sukcesu

### Funkcjonalność
- [ ] JWT authentication działa w WebSocket
- [ ] Stan gry zapisywany do DB
- [ ] Reconnection działa automatycznie
- [ ] Game state recovery po restarcie
- [ ] Mapowanie userId → roomId

### Performance
- [ ] Zapisywanie stanu < 100ms
- [ ] Ładowanie stanu < 500ms
- [ ] Reconnection < 2s
- [ ] Brak memory leaks

### Bezpieczeństwo
- [ ] JWT weryfikacja przy każdym połączeniu
- [ ] Sesje izolowane per-user
- [ ] Brak unauthorized access
- [ ] Secure token handling

### Reliability
- [ ] Brak data loss podczas reconnection
- [ ] Graceful error handling
- [ ] Automatic retry logic
- [ ] Consistent state sync

## 🐛 Troubleshooting

### Problemy z połączeniem
```bash
# Sprawdź czy serwery działają
curl http://localhost:3000/health
wscat -c ws://localhost:2567

# Sprawdź logi
tail -f game-server.log
tail -f server.log
```

### Problemy z bazą danych
```bash
# Sprawdź połączenie
psql $DATABASE_URL -c "SELECT 1"

# Sprawdź migracje
bun run db:migrate
```

### Problemy z JWT
```bash
# Sprawdź token w localStorage
# W browser console:
localStorage.getItem('auth_token')

# Sprawdź JWT_SECRET
echo $JWT_SECRET
```

## 📝 Raportowanie błędów

Przy zgłaszaniu błędów dołącz:
1. Kroki reprodukcji
2. Oczekiwany vs rzeczywisty rezultat
3. Logi z wszystkich 3 komponentów
4. Zrzut ekranu (jeśli relevant)
5. Informacje o środowisku (browser, OS)

## 🎯 Następne kroki

Po pomyślnym przejściu testów:
1. Load testing z wieloma graczami
2. Stress testing reconnection
3. Performance profiling
4. Security audit
5. Production deployment