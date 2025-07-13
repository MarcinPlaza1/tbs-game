# Project Documentation

Welcome to the in-depth reference for the **Turn-Based Strategy Game** code-base.  This document is intended for developers who want to understand, extend or integrate with any part of the system.

> **TL;DR** – if you just want to play with the app:
>
> ```bash
> bun run dev        # starts API + client + game-server together
> ```
>
> Visit http://localhost:5173 in your browser.

---

## Table of contents

1. [Architecture overview](#architecture-overview)
2. [Shared type definitions](#shared-type-definitions)
3. [Backend API (tRPC)](#backend-api-trpc)
4. [Game Server (Colyseus)](#game-server-colyseus)
5. [Client application](#client-application)
6. [Game engine (Babylon.js)](#game-engine-babylonjs)
7. [Extending the project](#extending-the-project)

---

## Architecture overview

```text
client/          – React + Vite UI (pages, Zustand stores, Babylon-powered canvas)
server/          – HTTP API built with tRPC & Bun (PostgreSQL via Drizzle ORM)
game-server/     – Real-time server powered by Colyseus (WebSocket transport)
shared/          – Pure TypeScript project with isomorphic **types** and **enums**
```

All packages live in a single npm workspace managed by **Bun**.  IDE-level type-safety is guaranteed end-to-end thanks to:

* `@trpc/*` – strongly typed RPC between React client & API server.
* `shared/`  – canonical source of game-related types re-used everywhere.

---

## Shared type definitions

Location: `shared/src`  – exported via `@tbs/shared` import alias.

| File | Highlights |
| ---- | ---------- |
| `types/game.ts`   | `GameStatus`, `GamePhase`, `GameState`, `GameSettings` |
| `types/player.ts` | `Player`, `PlayerResources`, `PlayerStats` |
| `types/unit.ts`   | `UnitType`, `Position`, `UnitStats`, `UnitAction` |
| `types/map.ts`    | `TileType`, `Tile`, `GameMap`, `MapMetadata` |
| `types/network.ts`| Low-level WebSocket message contracts |

These types are consumed directly by both the Colyseus room and the front-end – no additional mapping is necessary.

Example – use inside React component:

```ts
import type { GameMap } from '@tbs/shared';

function MiniMap({ map }: { map: GameMap }) {
  return <span>{map.name} ({map.width}×{map.height})</span>;
}
```

---

## Backend API (tRPC)

Base URL (dev): `http://localhost:3000/trpc`  
Every procedure below can be called via:

* **Generated client** – preferred, import `trpc` hook from `client/src/providers/TrpcProvider.tsx`.
* **Fetch** – for external integrations, examples shown in each section.

> **NOTE**  All *protected* procedures require the `Authorization: Bearer <jwt>` header.  Public procedures are open.

### Router: `auth`

| Procedure | Input | Returns | Notes |
|-----------|-------|---------|-------|
| `register` | `{ username, email, password }` | `{ user, token }` | Creates account |
| `login` | `{ username, password }` | `{ user, token }` | – |

React example:

```tsx
const { mutateAsync: register } = trpc.auth.register.useMutation();
await register({ username: 'neo', email: 'neo@zion.ai', password: 'matrix' });
```

cURL example:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  http://localhost:3000/trpc/auth.register \
  -d '{"input":{"username":"neo","email":"neo@zion.ai","password":"matrix"}}'
```

### Router: `user`

| Procedure | Protected? | Returns |
|-----------|------------|---------|
| `me`      | ✔ | `{ id, username, email, createdAt }` |
| `profile` | ✔ | `{ user, stats }` |

### Router: `game`

| Procedure | Input | Returns |
|-----------|-------|---------|
| `create`  | `{ mapId, settings:{ maxPlayers, turnTimeLimit?, isPrivate } }` | `Game` record |
| `join`    | `{ gameId }` | `{ success:true }` |
| `list`    | – | `Game[]` (WAITING only) |
| `get`     | `{ gameId }` | full `Game` with players & map |

### Router: `map`

| Procedure | Input | Returns |
|-----------|-------|---------|
| `list`    | – | `MapMetadata[]` |
| `get`     | `{ mapId }` | `GameMap` |
| `create`  | See below | Newly generated `GameMap` |

`create` input shape:

```ts
{
  name: string;
  description?: string;
  width: number;  // 10-50
  height: number; // 10-50
  maxPlayers: number; // 2-8
}
```

---

## Game Server (Colyseus)

WebSocket endpoint: `ws://localhost:2567`  
Room name: `game_room`

### State schema (excerpt)

```ts
class GameState extends Schema {
  @type('string')          id!: string;
  @type([ Player ])        players!: Player[];
  @type('number')          currentPlayerIndex!: number;
  @type([ Unit ])          units!: Unit[];
  @type([ Tile ])          tiles!: Tile[];
  // ...see game-server/src/schemas/GameState.ts
}
```

### Client-side connection example

```ts
import { Client } from 'colyseus.js';

const client = new Client('ws://localhost:2567');
const room = await client.joinOrCreate('game_room', { gameId: '<uuid>' });

room.state.onChange(() => {
  console.log('state updated', room.state.toJSON());
});

room.send('UNIT_MOVE', { unitId: 'u1', to: { x:4, y:8, z:0 } });
```

All message codes and payloads are enumerated in `shared/src/types/network.ts` – import them on both ends to avoid stringly-typed errors.

---

## Client application

Key public React components / hooks:

| Path | Purpose |
|------|---------|
| `src/pages/HomePage.tsx`    | Landing page & navigation |
| `src/pages/LoginPage.tsx`   | Login form (uses `useAuthStore`) |
| `src/pages/RegisterPage.tsx`| Registration form |
| `src/pages/LobbyPage.tsx`   | Lists & creates games (calls `trpc.game.*`) |
| `src/pages/GamePage.tsx`    | 3D battlefield, connects to Colyseus |
| `src/components/Layout.tsx` | Shared app shell w/ header |
| `src/providers/TrpcProvider.tsx` | tRPC React context – **export `trpc` hook** |
| `src/stores/authStore.ts`   | Zustand store for auth token & user |

Minimal auth flow in React:

```tsx
// inside any component
const login = trpc.auth.login.useMutation();

function handleSubmit() {
  login.mutate({ username, password }, {
    onSuccess({ token }) {
      useAuthStore.getState().login(token);
    }
  });
}
```

---

## Game engine (Babylon.js)

Entry point: `client/src/game/babylon/GameEngine.ts`  – creates Babylon scene, camera and delegates to **managers** below:

| Manager | Responsibility |
|---------|---------------|
| `InputManager`  | Keyboard / mouse handling, ray picking |
| `MapManager`    | Generates & renders tile map meshes |
| `UnitManager`   | Instantiates unit meshes, selection, movement animations |
| `UIManager`     | 2D React overlay (pop-ups, HUD) |

A quick bootstrap example (outside React):

```ts
import { GameEngine } from '@/game/babylon/GameEngine';

const canvas = document.getElementById('render');
const engine = new GameEngine(canvas as HTMLCanvasElement);

engine.start({ map, units });
```

Stop rendering loop:

```ts
engine.dispose();
```

---

## Extending the project

1. **Add a new tRPC procedure**  – create function in `server/src/trpc/routers/*.ts`, export it, run `bun run dev`.  TypeScript will instantly expose it on the client via the generated `trpc` hook.
2. **Add a new Colyseus message**  – put enum in `shared/src/types/network.ts`, import in both server & client.
3. **Add a new unit type**  – extend `shared/src/types/unit.ts` and update `UnitManager` mesh creation.
4. **Create a new map**  – call `trpc.map.create` or seed DB directly.

---

### Generating HTML API docs (optional)

Run once:

```bash
bun add -D typedoc
```

Then generate docs for **all** packages:

```bash
typedoc --entryPoints \
  server/src/index.ts \
  game-server/src/index.ts \
  client/src/main.tsx \
  shared/src/index.ts \
  --out docs/typedoc
```

Open `docs/typedoc/index.html` in your browser.

---

Happy hacking! 🎉