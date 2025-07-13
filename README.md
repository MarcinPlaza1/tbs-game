# Turn Based Strategy Game

Webowa gra strategiczna turowa zbudowana z wykorzystaniem nowoczesnych technologii.

## Technologie

### Frontend
- **React** z TypeScript
- **Vite** - szybki bundler
- **Babylon.js 8** z WebGPU - zaawansowana grafika 3D
- **Tailwind CSS** - stylowanie
- **Zustand** - zarządzanie stanem
- **tRPC** - type-safe API calls

### Backend
- **Bun 1.x** - szybki runtime JavaScript
- **tRPC** - type-safe API
- **PostgreSQL** - baza danych
- **Drizzle ORM** - type-safe ORM

### Game Server
- **Colyseus 1.0** - framework do gier real-time
- **WebSockets** - komunikacja w czasie rzeczywistym

## Wymagania

- Bun 1.x
- PostgreSQL 14+
- Node.js 18+ (dla niektórych narzędzi)

## Instalacja

1. Sklonuj repozytorium:
```bash
git clone <repository-url>
cd Core
```

2. Zainstaluj zależności:
```bash
bun install
```

3. Skonfiguruj bazę danych:
   - Utwórz bazę PostgreSQL
   - Skopiuj `server/.env.example` do `server/.env`
   - Uzułnij dane połączenia z bazą

4. Uruchom migracje bazy danych:
```bash
cd server
bun run db:generate
bun run db:migrate
bun run db:seed
```

## Uruchomienie

### Rozwój (wszystkie serwery razem):
```bash
bun run dev
```

### Lub uruchom każdy serwer osobno:

Backend API:
```bash
cd server
bun run dev
```

Game Server:
```bash
cd game-server
bun run dev
```

Frontend:
```bash
cd client
bun run dev
```

## Struktura projektu

```
Core/
├── client/           # Frontend React
│   ├── src/
│   │   ├── components/
│   │   ├── game/     # Logika gry i Babylon.js
│   │   ├── pages/
│   │   └── stores/
├── server/           # Backend API
│   ├── src/
│   │   ├── db/       # Schemat bazy i migracje
│   │   └── trpc/     # Endpoints API
├── game-server/      # Serwer gry Colyseus
│   ├── src/
│   │   ├── rooms/    # Pokoje gry
│   │   └── schemas/  # Schematy stanu gry
└── shared/           # Wspólne typy TypeScript
```

## Funkcjonalności

- System autoryzacji (rejestracja/logowanie)
- Lobby z listą dostępnych gier
- Tworzenie i dołączanie do gier
- Grafika 3D z wykorzystaniem Babylon.js i WebGPU
- Różne typy jednostek (wojownik, łucznik, mag, kawaleria, oblężenie)
- Różnorodny teren (trawa, las, góry, woda, drogi)
- System turowy z zarządzaniem zasobami
- Chat w grze
- Synchronizacja stanu gry w czasie rzeczywistym

## Rozwój

### Dodawanie nowych typów jednostek
Edytuj `shared/src/types/unit.ts` i zaktualizuj managery w kliencie.

### Tworzenie nowych map
Użyj endpointa API do tworzenia map lub edytuj skrypt seedowania.

### WebGPU
Gra automatycznie wykrywa wsparcie dla WebGPU i używa go jeśli dostępne, w przeciwnym razie przełącza się na WebGL2. 