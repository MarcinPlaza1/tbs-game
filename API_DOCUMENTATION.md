# Turn Based Strategy Game - API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication APIs](#authentication-apis)
3. [Game Management APIs](#game-management-apis)
4. [Map APIs](#map-apis)
5. [User APIs](#user-apis)
6. [Game Server APIs](#game-server-apis)
7. [Shared Types](#shared-types)
8. [Client Components](#client-components)
9. [State Management](#state-management)
10. [Database Schema](#database-schema)
11. [Environment Configuration](#environment-configuration)

## Overview

This is a comprehensive guide to the APIs, functions, and components available in the Turn Based Strategy Game. The project is built with:

- **Backend**: tRPC + Bun + PostgreSQL + Drizzle ORM
- **Frontend**: React + TypeScript + Vite + Babylon.js + Tailwind CSS
- **Game Server**: Colyseus + WebSockets
- **Shared**: TypeScript types and utilities

## Authentication APIs

### Router: `auth`

#### `auth.register`
Creates a new user account.

**Type**: `publicProcedure.mutation`

**Input Schema**:
```typescript
{
  username: string (min: 3, max: 50)
  email: string (email format)
  password: string (min: 6)
}
```

**Returns**:
```typescript
{
  user: {
    id: string
    username: string
    email: string
  }
  token: string
}
```

**Example**:
```typescript
// Client usage
const { mutate: register } = trpc.auth.register.useMutation();

register({
  username: "player123",
  email: "player@example.com",
  password: "securepassword"
});
```

#### `auth.login`
Authenticates a user and returns a JWT token.

**Type**: `publicProcedure.mutation`

**Input Schema**:
```typescript
{
  username: string
  password: string
}
```

**Returns**:
```typescript
{
  user: {
    id: string
    username: string
    email: string
  }
  token: string
}
```

**Example**:
```typescript
// Client usage
const { mutate: login } = trpc.auth.login.useMutation();

login({
  username: "player123",
  password: "securepassword"
});
```

## Game Management APIs

### Router: `game`

#### `game.create`
Creates a new game instance.

**Type**: `protectedProcedure.mutation`

**Input Schema**:
```typescript
{
  mapId: string (UUID)
  settings: {
    maxPlayers: number (min: 2, max: 8)
    turnTimeLimit?: number (seconds)
    isPrivate: boolean
  }
}
```

**Returns**:
```typescript
{
  id: string
  mapId: string
  settings: GameSettings
  status: GameStatus
  phase: GamePhase
  currentPlayerIndex: number
  turnNumber: number
  winnerId?: string
  createdAt: Date
  updatedAt: Date
}
```

**Example**:
```typescript
// Client usage
const { mutate: createGame } = trpc.game.create.useMutation();

createGame({
  mapId: "123e4567-e89b-12d3-a456-426614174000",
  settings: {
    maxPlayers: 4,
    turnTimeLimit: 120,
    isPrivate: false
  }
});
```

#### `game.join`
Joins an existing game.

**Type**: `protectedProcedure.mutation`

**Input Schema**:
```typescript
{
  gameId: string (UUID)
}
```

**Returns**:
```typescript
{
  success: boolean
}
```

**Example**:
```typescript
// Client usage
const { mutate: joinGame } = trpc.game.join.useMutation();

joinGame({
  gameId: "123e4567-e89b-12d3-a456-426614174000"
});
```

#### `game.list`
Lists all available games.

**Type**: `protectedProcedure.query`

**Input**: None

**Returns**:
```typescript
Array<{
  id: string
  mapId: string
  settings: GameSettings
  status: GameStatus
  players: Array<{
    id: string
    userId: string
    playerIndex: number
    color: string
    isReady: boolean
    isActive: boolean
    user: {
      id: string
      username: string
      email: string
    }
  }>
  map: {
    id: string
    name: string
    description: string
    width: number
    height: number
    maxPlayers: number
  }
  createdAt: Date
  updatedAt: Date
}>
```

**Example**:
```typescript
// Client usage
const { data: games } = trpc.game.list.useQuery();

// Display games
games?.forEach(game => {
  console.log(`Game ${game.id}: ${game.players.length}/${game.settings.maxPlayers} players`);
});
```

#### `game.get`
Gets details of a specific game.

**Type**: `protectedProcedure.query`

**Input Schema**:
```typescript
{
  gameId: string (UUID)
}
```

**Returns**:
```typescript
{
  id: string
  mapId: string
  settings: GameSettings
  status: GameStatus
  phase: GamePhase
  currentPlayerIndex: number
  turnNumber: number
  winnerId?: string
  players: Array<GamePlayer>
  map: GameMap
  createdAt: Date
  updatedAt: Date
}
```

**Example**:
```typescript
// Client usage
const { data: game } = trpc.game.get.useQuery({ 
  gameId: "123e4567-e89b-12d3-a456-426614174000" 
});

console.log(`Game status: ${game?.status}`);
console.log(`Current player: ${game?.currentPlayerIndex}`);
```

## Map APIs

### Router: `map`

#### `map.list`
Lists all available maps.

**Type**: `publicProcedure.query`

**Input**: None

**Returns**:
```typescript
Array<{
  id: string
  name: string
  description: string
  width: number
  height: number
  maxPlayers: number
  createdAt: Date
}>
```

**Example**:
```typescript
// Client usage
const { data: maps } = trpc.map.list.useQuery();

// Display maps
maps?.forEach(map => {
  console.log(`${map.name} (${map.width}x${map.height}) - ${map.maxPlayers} players`);
});
```

#### `map.get`
Gets details of a specific map.

**Type**: `publicProcedure.query`

**Input Schema**:
```typescript
{
  mapId: string (UUID)
}
```

**Returns**:
```typescript
{
  id: string
  name: string
  description: string
  width: number
  height: number
  tileData: Tile[][]
  spawnPoints: Position[]
  maxPlayers: number
  createdAt: Date
}
```

**Example**:
```typescript
// Client usage
const { data: map } = trpc.map.get.useQuery({ 
  mapId: "123e4567-e89b-12d3-a456-426614174000" 
});

console.log(`Map: ${map?.name}`);
console.log(`Size: ${map?.width}x${map?.height}`);
console.log(`Spawn points: ${map?.spawnPoints.length}`);
```

#### `map.create`
Creates a new map.

**Type**: `protectedProcedure.mutation`

**Input Schema**:
```typescript
{
  name: string (min: 3, max: 100)
  description?: string
  width: number (min: 10, max: 50)
  height: number (min: 10, max: 50)
  maxPlayers: number (min: 2, max: 8)
}
```

**Returns**:
```typescript
{
  id: string
  name: string
  description: string
  width: number
  height: number
  tileData: Tile[][]
  spawnPoints: Position[]
  maxPlayers: number
  createdAt: Date
}
```

**Example**:
```typescript
// Client usage
const { mutate: createMap } = trpc.map.create.useMutation();

createMap({
  name: "Battle Plains",
  description: "A large open battlefield",
  width: 25,
  height: 25,
  maxPlayers: 6
});
```

## User APIs

### Router: `user`

#### `user.me`
Gets current user information.

**Type**: `protectedProcedure.query`

**Input**: None

**Returns**:
```typescript
{
  id: string
  username: string
  email: string
  createdAt: Date
}
```

**Example**:
```typescript
// Client usage
const { data: user } = trpc.user.me.useQuery();

console.log(`Welcome, ${user?.username}!`);
```

#### `user.profile`
Gets user profile with stats.

**Type**: `protectedProcedure.query`

**Input**: None

**Returns**:
```typescript
{
  user: {
    id: string
    username: string
    email: string
  }
  stats: {
    gamesPlayed: number
    wins: number
    losses: number
    rating: number
  }
}
```

**Example**:
```typescript
// Client usage
const { data: profile } = trpc.user.profile.useQuery();

console.log(`Rating: ${profile?.stats.rating}`);
console.log(`Win rate: ${profile?.stats.wins}/${profile?.stats.gamesPlayed}`);
```

## Game Server APIs

### WebSocket Connection

The game server uses Colyseus for real-time communication. Connect to `ws://localhost:2567`.

### Room: `game_room`

#### Joining a Room
```typescript
import { Client } from 'colyseus.js';

const client = new Client('ws://localhost:2567');

const room = await client.joinOrCreate('game_room', {
  gameId: 'game-uuid',
  userId: 'user-uuid',
  username: 'player123'
});
```

#### Message Types

##### Client Messages

**`PLAYER_READY`**
```typescript
room.send('player_ready', { ready: true });
```

**`UNIT_ACTION`**
```typescript
room.send('unit_action', {
  action: {
    unitId: 'unit-uuid',
    type: 'move',
    targetPosition: { x: 5, y: 3, z: 0 }
  }
});
```

**`END_TURN`**
```typescript
room.send('end_turn');
```

**`CHAT_MESSAGE`**
```typescript
room.send('chat_message', 'Hello, world!');
```

##### Server Messages

**`GAME_STATE_UPDATE`**
```typescript
room.onMessage('game_state_update', (message) => {
  console.log('Game state updated:', message.gameState);
});
```

**`PLAYER_JOINED`**
```typescript
room.onMessage('player_joined', (message) => {
  console.log('Player joined:', message.player);
});
```

**`TURN_CHANGED`**
```typescript
room.onMessage('turn_changed', (message) => {
  console.log('Turn changed to player:', message.currentPlayerIndex);
});
```

### Game State Schema

The game state is synchronized using Colyseus schemas:

```typescript
// Access game state
room.onStateChange((state) => {
  console.log('Game ID:', state.gameId);
  console.log('Status:', state.status);
  console.log('Current player:', state.currentPlayerIndex);
  console.log('Turn number:', state.turnNumber);
});

// Access players
room.state.players.forEach((player, sessionId) => {
  console.log(`Player ${player.username}: ${player.gold} gold`);
});

// Access units
room.state.units.forEach((unit, unitId) => {
  console.log(`Unit ${unit.id} at (${unit.position.x}, ${unit.position.y})`);
});
```

## Shared Types

### Game Types

```typescript
export enum GameStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress',
  FINISHED = 'finished'
}

export enum GamePhase {
  DEPLOYMENT = 'deployment',
  BATTLE = 'battle'
}

export interface GameState {
  id: string;
  status: GameStatus;
  phase: GamePhase;
  currentPlayerIndex: number;
  turnNumber: number;
  players: string[];
  winner?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameSettings {
  mapId: string;
  maxPlayers: number;
  turnTimeLimit?: number;
  isPrivate: boolean;
}
```

### Player Types

```typescript
export interface Player {
  id: string;
  username: string;
  color: string;
  isReady: boolean;
  isActive: boolean;
  resources: PlayerResources;
}

export interface PlayerResources {
  gold: number;
  mana: number;
  actionPoints: number;
}

export interface PlayerStats {
  playerId: string;
  wins: number;
  losses: number;
  draws: number;
  totalGames: number;
  rating: number;
}
```

### Unit Types

```typescript
export enum UnitType {
  WARRIOR = 'warrior',
  ARCHER = 'archer',
  MAGE = 'mage',
  CAVALRY = 'cavalry',
  SIEGE = 'siege'
}

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface UnitStats {
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  movement: number;
  range: number;
}

export interface Unit {
  id: string;
  playerId: string;
  type: UnitType;
  position: Position;
  stats: UnitStats;
  hasMoved: boolean;
  hasAttacked: boolean;
  isAlive: boolean;
}

export interface UnitAction {
  unitId: string;
  type: 'move' | 'attack' | 'ability';
  targetPosition?: Position;
  targetUnitId?: string;
  abilityId?: string;
}
```

### Map Types

```typescript
export enum TileType {
  GRASS = 'grass',
  FOREST = 'forest',
  MOUNTAIN = 'mountain',
  WATER = 'water',
  ROAD = 'road',
  CASTLE = 'castle'
}

export interface Tile {
  position: Position;
  type: TileType;
  isWalkable: boolean;
  movementCost: number;
  defenseBonus: number;
}

export interface GameMap {
  id: string;
  name: string;
  width: number;
  height: number;
  tiles: Tile[][];
  spawnPoints: Position[];
}

export interface MapMetadata {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  playerCount: number;
  size: 'small' | 'medium' | 'large';
}
```

### Network Types

```typescript
export enum ClientMessageType {
  JOIN_GAME = 'join_game',
  LEAVE_GAME = 'leave_game',
  PLAYER_READY = 'player_ready',
  UNIT_ACTION = 'unit_action',
  END_TURN = 'end_turn',
  CHAT_MESSAGE = 'chat_message'
}

export enum ServerMessageType {
  GAME_STATE_UPDATE = 'game_state_update',
  PLAYER_JOINED = 'player_joined',
  PLAYER_LEFT = 'player_left',
  UNIT_ACTION_RESULT = 'unit_action_result',
  TURN_CHANGED = 'turn_changed',
  GAME_STARTED = 'game_started',
  GAME_ENDED = 'game_ended',
  ERROR = 'error',
  CHAT_MESSAGE = 'chat_message'
}
```

## Client Components

### Layout Component

**File**: `client/src/components/Layout.tsx`

Main layout component with navigation and authentication state.

**Props**: None

**Features**:
- Navigation bar with authentication status
- Dynamic menu based on authentication
- Responsive design with Tailwind CSS

**Usage**:
```typescript
import Layout from './components/Layout';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        {/* Other routes */}
      </Route>
    </Routes>
  );
}
```

### Page Components

#### HomePage
**File**: `client/src/pages/HomePage.tsx`

Landing page with game introduction and navigation.

**Features**:
- Game overview and features
- Dynamic buttons based on authentication
- Responsive grid layout

#### LoginPage
**File**: `client/src/pages/LoginPage.tsx`

User authentication page.

**Features**:
- Form validation
- tRPC integration for authentication
- Automatic redirect after login

#### RegisterPage
**File**: `client/src/pages/RegisterPage.tsx`

User registration page.

**Features**:
- Form validation with email format checking
- Password strength requirements
- tRPC integration for registration

#### LobbyPage
**File**: `client/src/pages/LobbyPage.tsx`

Game lobby with list of available games.

**Features**:
- Real-time game list updates
- Create and join game functionality
- Player count and game status display

#### GamePage
**File**: `client/src/pages/GamePage.tsx`

Main game interface with 3D rendering.

**Features**:
- Babylon.js 3D rendering
- WebGPU support with WebGL2 fallback
- Real-time game state synchronization
- Unit management and actions

### TrpcProvider

**File**: `client/src/providers/TrpcProvider.tsx`

Provider for tRPC client configuration.

**Features**:
- Automatic authentication header injection
- Query client configuration
- Type-safe API calls

**Usage**:
```typescript
import { TrpcProvider } from './providers/TrpcProvider';

function App() {
  return (
    <TrpcProvider>
      <YourAppContent />
    </TrpcProvider>
  );
}
```

## State Management

### Auth Store

**File**: `client/src/stores/authStore.ts`

Zustand store for authentication state management.

**State**:
```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}
```

**Usage**:
```typescript
import { useAuthStore } from './stores/authStore';

function Component() {
  const { user, isAuthenticated, login, logout } = useAuthStore();
  
  // Use authentication state
  if (isAuthenticated) {
    return <div>Welcome, {user?.username}!</div>;
  }
  
  return <LoginButton onClick={() => login(userData, token)} />;
}
```

**Features**:
- Persistent storage with localStorage
- Type-safe state management
- Automatic state synchronization

## Database Schema

### Tables

#### Users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Games
```sql
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(20) DEFAULT 'waiting',
  phase VARCHAR(20) DEFAULT 'deployment',
  current_player_index INTEGER DEFAULT 0,
  turn_number INTEGER DEFAULT 1,
  map_id UUID NOT NULL,
  settings JSONB NOT NULL,
  winner_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Game Players
```sql
CREATE TABLE game_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id),
  user_id UUID NOT NULL REFERENCES users(id),
  player_index INTEGER NOT NULL,
  color VARCHAR(7) NOT NULL,
  is_ready BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  resources JSONB DEFAULT '{"gold": 1000, "mana": 100, "actionPoints": 3}'
);
```

#### Maps
```sql
CREATE TABLE maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  tile_data JSONB NOT NULL,
  spawn_points JSONB NOT NULL,
  max_players INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Relationships

- Users can have many game players
- Games have many players and belong to one map
- Game players belong to one game and one user
- Maps can have many games

## Environment Configuration

### Server Environment Variables

**File**: `server/.env`

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://username:password@localhost:5432/dbname
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
COLYSEUS_URL=ws://localhost:2567
```

### Game Server Environment Variables

**File**: `game-server/.env`

```env
GAME_SERVER_PORT=2567
```

## Development Setup

### Prerequisites
- Bun 1.x
- PostgreSQL 14+
- Node.js 18+

### Installation

1. Clone the repository
2. Install dependencies: `bun install`
3. Set up environment variables
4. Run database migrations: `bun run db:migrate`
5. Seed database: `bun run db:seed`

### Running the Application

**Development mode (all servers)**:
```bash
bun run dev
```

**Individual servers**:
```bash
# Backend API
cd server && bun run dev

# Game Server
cd game-server && bun run dev

# Frontend
cd client && bun run dev
```

## API Client Usage Examples

### Complete Authentication Flow

```typescript
import { trpc } from './utils/trpc';
import { useAuthStore } from './stores/authStore';

function AuthExample() {
  const { login } = useAuthStore();
  
  // Register new user
  const { mutate: register } = trpc.auth.register.useMutation({
    onSuccess: (data) => {
      login(data.user, data.token);
    }
  });
  
  // Login existing user
  const { mutate: loginMutation } = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      login(data.user, data.token);
    }
  });
  
  return (
    <div>
      <button onClick={() => register({
        username: 'newplayer',
        email: 'new@example.com',
        password: 'password123'
      })}>
        Register
      </button>
      
      <button onClick={() => loginMutation({
        username: 'existingplayer',
        password: 'password123'
      })}>
        Login
      </button>
    </div>
  );
}
```

### Game Management Flow

```typescript
function GameExample() {
  const { data: games } = trpc.game.list.useQuery();
  const { mutate: createGame } = trpc.game.create.useMutation();
  const { mutate: joinGame } = trpc.game.join.useMutation();
  
  return (
    <div>
      <button onClick={() => createGame({
        mapId: 'map-uuid',
        settings: {
          maxPlayers: 4,
          isPrivate: false
        }
      })}>
        Create Game
      </button>
      
      {games?.map(game => (
        <div key={game.id}>
          <h3>{game.map.name}</h3>
          <p>{game.players.length}/{game.settings.maxPlayers} players</p>
          <button onClick={() => joinGame({ gameId: game.id })}>
            Join Game
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Real-time Game Connection

```typescript
import { Client } from 'colyseus.js';

async function connectToGame(gameId: string, userId: string, username: string) {
  const client = new Client('ws://localhost:2567');
  
  try {
    const room = await client.joinOrCreate('game_room', {
      gameId,
      userId,
      username
    });
    
    // Listen for game state changes
    room.onStateChange((state) => {
      console.log('Game state updated:', state);
    });
    
    // Listen for messages
    room.onMessage('player_joined', (message) => {
      console.log('Player joined:', message.player);
    });
    
    room.onMessage('turn_changed', (message) => {
      console.log('Turn changed to:', message.currentPlayerIndex);
    });
    
    // Send messages
    room.send('player_ready', { ready: true });
    
    // Move unit
    room.send('unit_action', {
      action: {
        unitId: 'unit-uuid',
        type: 'move',
        targetPosition: { x: 5, y: 3, z: 0 }
      }
    });
    
    // Attack with unit
    room.send('unit_action', {
      action: {
        unitId: 'unit-uuid',
        type: 'attack',
        targetUnitId: 'target-unit-uuid'
      }
    });
    
    // End turn
    room.send('end_turn');
    
    return room;
  } catch (error) {
    console.error('Failed to connect to game:', error);
    throw error;
  }
}
```

This documentation provides comprehensive coverage of all public APIs, components, and functions in the Turn Based Strategy Game project. Each section includes type definitions, usage examples, and practical implementation details.