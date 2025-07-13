# Implementacja Funkcji Bezpieczeństwa

## Przegląd zaimplementowanych funkcji

### 1. Rate Limiting ✅

**Implementacja**: `/server/src/trpc/middleware/simpleRateLimit.ts`

**Funkcje**:
- Ograniczanie liczby żądań w określonym czasie
- Różne limity dla różnych endpointów
- Przechowywanie w pamięci (in-memory storage)
- Automatyczne czyszczenie starych wpisów

**Konfiguracja limitów**:
```typescript
const endpointConfigs = {
  'auth.login': { windowMs: 15 * 60 * 1000, maxRequests: 5 },      // 5 prób logowania na 15 min
  'auth.register': { windowMs: 60 * 60 * 1000, maxRequests: 3 },   // 3 rejestracje na godzinę
  'auth.passwordResetRequest': { windowMs: 60 * 60 * 1000, maxRequests: 3 }, // 3 reset hasła na godzinę
  'auth.refreshToken': { windowMs: 15 * 60 * 1000, maxRequests: 10 }, // 10 odnowień tokena na 15 min
}
```

**Zastosowanie**:
- Dodane do wszystkich wrażliwych endpointów auth
- Identyfikacja na podstawie ID użytkownika lub IP

### 2. Weryfikacja Email ✅

**Implementacja**: Rozszerzone w `/server/src/trpc/routers/auth.ts`

**Nowe pola w bazie danych**:
```sql
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN email_verification_token TEXT;
ALTER TABLE users ADD COLUMN email_verification_token_expiry TIMESTAMP;
```

**Nowe endpointy**:
- `auth.verifyEmail` - weryfikacja email za pomocą tokena
- `auth.resendVerification` - ponowne wysłanie tokena weryfikacji

**Funkcje**:
- Automatyczne generowanie tokena weryfikacji przy rejestracji
- Token ważny przez 24 godziny
- Bezpieczna weryfikacja bez ujawniania informacji o istnieniu emaila
- Możliwość ponownego wysłania tokena

### 3. Ochrona CSRF ✅

**Implementacja**: `/server/src/trpc/middleware/csrf.ts`

**Nowa tabela w bazie danych**:
```sql
CREATE TABLE csrf_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR(255) NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Nowy endpoint**:
- `auth.generateCSRFToken` - generowanie tokena CSRF

**Funkcje**:
- Generowanie unikalnych tokenów CSRF
- Przechowywanie w bazie danych
- Automatyczne czyszczenie wygasłych tokenów
- Tokeny ważne przez 24 godziny

## Zmiany w schemacie bazy danych

### Tabela `users` - dodane pola:
```sql
email_verified BOOLEAN DEFAULT FALSE
email_verification_token TEXT
email_verification_token_expiry TIMESTAMP
```

### Nowe tabele:
```sql
-- Rate limiting
CREATE TABLE rate_limit_log (
  id UUID PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- CSRF protection
CREATE TABLE csrf_tokens (
  id UUID PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Jak uruchomić migrację

```bash
cd server
bun run db:generate  # Wygeneruj migrację
bun run db:migrate   # Zastosuj migrację
```

## Przykład użycia

### 1. Rejestracja z weryfikacją email
```typescript
// Klient
const result = await client.auth.register.mutate({
  username: "user123",
  email: "user@example.com",
  password: "securePassword123"
});

// Użytkownik otrzymuje email z tokenem weryfikacji
// (w implementacji deweloperskiej token jest zwracany w odpowiedzi)

// Weryfikacja
await client.auth.verifyEmail.mutate({
  token: "abc123def456..."
});
```

### 2. Użycie CSRF tokena
```typescript
// Pobierz token CSRF
const csrfResult = await client.auth.generateCSRFToken.mutate();
const csrfToken = csrfResult.token;

// Użyj tokena w kolejnych zapytaniach
// (implementacja zależy od konkretnego sposobu przesyłania tokena)
```

### 3. Rate limiting
Rate limiting działa automatycznie dla wszystkich skonfigurowanych endpointów. Jeśli limit zostanie przekroczony, endpoint zwróci błąd `TOO_MANY_REQUESTS` z informacją o czasie resetowania.

## Uwagi dotyczące produkcji

### Rate Limiting
- Obecna implementacja używa pamięci in-memory
- W środowisku produkcyjnym zaleca się użycie Redis lub podobnego rozwiązania
- Dla aplikacji distributed należy rozważyć centralne przechowywanie limitów

### Email Verification
- Implementacja zawiera mockową funkcję wysyłania emaili
- W produkcji należy zintegrować z usługą emailową (SendGrid, AWS SES, itp.)
- Dodać templates dla emaili weryfikacyjnych

### CSRF Protection
- Tokeny CSRF muszą być przesyłane w headerach HTTP
- W aplikacjach SPA można przechowywać tokeny w localStorage/sessionStorage
- Implementacja tRPC wymaga dodatkowej konfiguracji middleware HTTP

## Bezpieczeństwo

- Wszystkie tokeny są generowane kryptograficznie bezpiecznie (`randomBytes`)
- Hasła są zahashowane za pomocą bcrypt
- Tokeny mają ograniczony czas życia
- Implementowano zasadę "nie ujawniaj informacji" (np. przy sprawdzaniu emaila)
- Rate limiting chroni przed atakami brute force

## Dalsze ulepszenia

1. **Dodanie IP-based rate limiting** - ograniczenia na podstawie adresu IP
2. **Account lockout** - blokowanie kont po zbyt wielu nieudanych próbach logowania
3. **Audit logging** - logowanie wszystkich akcji związanych z bezpieczeństwem
4. **2FA (Two-Factor Authentication)** - dwuetapowe uwierzytelnianie
5. **Session management** - zarządzanie sesjami użytkowników