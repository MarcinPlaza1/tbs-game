# Turn-Based Strategy Game - API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Client-Side APIs](#client-side-apis)
3. [Server-Side APIs](#server-side-apis)
4. [Game Server APIs](#game-server-apis)
5. [Shared Types](#shared-types)
6. [Components](#components)
7. [State Management](#state-management)
8. [Usage Examples](#usage-examples)

## Overview

This is a turn-based strategy game built with:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + tRPC + Drizzle ORM
- **Game Server**: Colyseus WebSocket server
- **Database**: PostgreSQL
- **State Management**: Zustand + React Query

## Client-Side APIs

### Main Application Entry Point

#### `main.tsx`
The main entry point for the React application.

```typescript
// Entry point configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
```

**Features:**
- Sets up React Query client with optimized defaults
- Configures React Router for navigation
- Wraps the app with necessary providers

### App Component

#### `App.tsx`
Main application component with routing and authentication guards.

```typescript
function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <TrpcProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route 
            path="lobby" 
            element={isAuthenticated ? <LobbyPage /> : <Navigate to="/login" replace />} 
          />
          <Route 
            path="game/:gameId" 
            element={isAuthenticated ? <GamePage /> : <Navigate to="/login" replace />} 
          />
        </Route>
      </Routes>
    </TrpcProvider>
  );
}
```

**Features:**
- Protected routes with authentication guards
- Automatic redirects for unauthenticated users
- Nested routing with layout wrapper

### Layout Component

#### `Layout.tsx`
Main layout component providing navigation and structure.

```typescript
function Layout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-game-primary border-b border-gray-700">
        {/* Navigation content */}
      </nav>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-game-primary border-t border-gray-700 py-4">
        {/* Footer content */}
      </footer>
    </div>
  );
}
```

**Features:**
- Responsive navigation bar
- User authentication status display
- Logout functionality
- Consistent layout structure

### tRPC Provider

#### `TrpcProvider.tsx`
Provides tRPC client configuration with authentication.

```typescript
export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: 'http://localhost:3000',
          headers() {
            const token = useAuthStore.getState().token;
            return token ? { authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

**Features:**
- Automatic token injection for authenticated requests
- Batch request optimization
- React Query integration

## Server-Side APIs

### Main Server Entry Point

#### `server/src/index.ts`
HTTP server setup with tRPC and CORS configuration.

```typescript
const server = createHTTPServer({
  router: appRouter,
  createContext,
  middleware: cors({
    origin: env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }),
});

server.listen(env.PORT || 3000);
```

**Features:**
- CORS configuration for cross-origin requests
- tRPC HTTP adapter
- Environment-based configuration

### tRPC Configuration

#### `server/src/trpc/trpc.ts`
tRPC setup with error handling and middleware.

```typescript
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof z.ZodError
            ? error.cause.flatten()
            : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(isAuthed);
```

**Features:**
- Zod error formatting
- Authentication middleware
- Public and protected procedure types

### Context Management

#### `server/src/trpc/context.ts`
Request context with user authentication.

```typescript
export interface Context {
  db: typeof db;
  user?: User;
}

export async function createContext({ req }: CreateHTTPContextOptions): Promise<Context> {
  let user: User | undefined;

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };
      
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, decoded.userId),
      });
      
      if (dbUser) {
        user = {
          id: dbUser.id,
          username: dbUser.username,
          email: dbUser.email,
        };
      }
    }
  } catch (error) {
    // Invalid token, continue without user
  }

  return {
    db,
    user,
  };
}
```

**Features:**
- JWT token validation
- Database connection injection
- User context for authenticated requests

## Authentication APIs

### Auth Router

#### `server/src/trpc/routers/auth.ts`

**Register User**
```typescript
register: publicProcedure
  .input(registerSchema)
  .mutation(async ({ ctx, input }) => {
    const { username, email, password } = input;

    // Check if user already exists
    const existingUser = await ctx.db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existingUser) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Username already taken',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const [newUser] = await ctx.db
      .insert(users)
      .values({
        username,
        email,
        passwordHash,
      })
      .returning();

    // Generate token
    const token = jwt.sign(
      { userId: newUser.id },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
      },
      token,
    };
  })
```

**Login User**
```typescript
login: publicProcedure
  .input(loginSchema)
  .mutation(async ({ ctx, input }) => {
    const { username, password } = input;

    // Find user
    const user = await ctx.db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      token,
    };
  })
```

**Input Schemas:**
```typescript
const registerSchema = z.object({
  username: z.string().min(3).max(50),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});
```

## Game APIs

### Game Router

#### `server/src/trpc/routers/game.ts`

**Create Game**
```typescript
create: protectedProcedure
  .input(createGameSchema)
  .mutation(async ({ ctx, input }) => {
    const [game] = await ctx.db
      .insert(games)
      .values({
        mapId: input.mapId,
        settings: input.settings,
      })
      .returning();

    // Add creator as first player
    await ctx.db.insert(gamePlayers).values({
      gameId: game.id,
      userId: ctx.user.id,
      playerIndex: 0,
      color: '#FF0000', // Red for first player
    });

    return game;
  })
```

**Join Game**
```typescript
join: protectedProcedure
  .input(joinGameSchema)
  .mutation(async ({ ctx, input }) => {
    // Get game and check if it exists
    const game = await ctx.db.query.games.findFirst({
      where: eq(games.id, input.gameId),
      with: {
        players: true,
      },
    });

    if (!game) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Game not found',
      });
    }

    // Check if game is full
    const settings = game.settings as any;
    if (game.players.length >= settings.maxPlayers) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Game is full',
      });
    }

    // Check if player already in game
    const existingPlayer = game.players.find(p => p.userId === ctx.user.id);
    if (existingPlayer) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Already in this game',
      });
    }

    // Add player to game
    const playerColors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'];
    const playerIndex = game.players.length;

    await ctx.db.insert(gamePlayers).values({
      gameId: game.id,
      userId: ctx.user.id,
      playerIndex,
      color: playerColors[playerIndex],
    });

    return { success: true };
  })
```

**List Games**
```typescript
list: protectedProcedure.query(async ({ ctx }) => {
  const gamesList = await ctx.db.query.games.findMany({
    where: eq(games.status, 'waiting'),
    with: {
      players: {
        with: {
          user: true,
        },
      },
      map: true,
    },
    orderBy: (games, { desc }) => [desc(games.createdAt)],
  });

  return gamesList;
})
```

**Get Game**
```typescript
get: protectedProcedure
  .input(z.object({ gameId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    const game = await ctx.db.query.games.findFirst({
      where: eq(games.id, input.gameId),
      with: {
        players: {
          with: {
            user: true,
          },
        },
        map: true,
      },
    });

    if (!game) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Game not found',
      });
    }

    return game;
  })
```

**Input Schemas:**
```typescript
const createGameSchema = z.object({
  mapId: z.string().uuid(),
  settings: z.object({
    maxPlayers: z.number().min(2).max(8),
    turnTimeLimit: z.number().optional(),
    isPrivate: z.boolean(),
  }),
});

const joinGameSchema = z.object({
  gameId: z.string().uuid(),
});
```

## Map APIs

### Map Router

#### `server/src/trpc/routers/map.ts`

**List Maps**
```typescript
list: publicProcedure.query(async ({ ctx }) => {
  return await ctx.db.query.maps.findMany({
    orderBy: (maps, { desc }) => [desc(maps.createdAt)],
  });
})
```

**Get Map**
```typescript
get: publicProcedure
  .input(z.object({ mapId: z.string().uuid() }))
  .query(async ({ ctx, input }) => {
    return await ctx.db.query.maps.findFirst({
      where: eq(maps.id, input.mapId),
    });
  })
```

**Create Map**
```typescript
create: protectedProcedure
  .input(createMapSchema)
  .mutation(async ({ ctx, input }) => {
    // Generate basic map tile data
    const tileData: any[][] = [];
    const spawnPoints: any[] = [];

    for (let y = 0; y < input.height; y++) {
      tileData[y] = [];
      for (let x = 0; x < input.width; x++) {
        // Create varied terrain
        let type = TileType.GRASS;
        const rand = Math.random();
        
        if (rand < 0.1) type = TileType.FOREST;
        else if (rand < 0.15) type = TileType.MOUNTAIN;
        else if (rand < 0.2) type = TileType.WATER;
        
        tileData[y][x] = {
          position: { x, y, z: 0 },
          type,
          isWalkable: type !== TileType.WATER && type !== TileType.MOUNTAIN,
          movementCost: type === TileType.FOREST ? 2 : 1,
          defenseBonus: type === TileType.FOREST ? 1 : type === TileType.MOUNTAIN ? 2 : 0,
        };
      }
    }

    // Add spawn points in corners and edges
    const margin = 3;
    if (input.maxPlayers >= 2) {
      spawnPoints.push({ x: margin, y: margin, z: 0 });
      spawnPoints.push({ x: input.width - margin - 1, y: input.height - margin - 1, z: 0 });
    }
    // ... additional spawn points based on maxPlayers

    const [map] = await ctx.db
      .insert(maps)
      .values({
        name: input.name,
        description: input.description || '',
        width: input.width,
        height: input.height,
        tileData,
        spawnPoints,
        maxPlayers: input.maxPlayers,
      })
      .returning();

    return map;
  })
```

**Input Schema:**
```typescript
const createMapSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().optional(),
  width: z.number().min(10).max(50),
  height: z.number().min(10).max(50),
  maxPlayers: z.number().min(2).max(8),
});
```

## User APIs

### User Router

#### `server/src/trpc/routers/user.ts`

**Get Current User**
```typescript
me: protectedProcedure.query(async ({ ctx }) => {
  const user = await ctx.db.query.users.findFirst({
    where: eq(users.id, ctx.user.id),
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.createdAt,
  };
})
```

**Get User Profile**
```typescript
profile: protectedProcedure.query(async ({ ctx }) => {
  return {
    user: {
      id: ctx.user.id,
      username: ctx.user.username,
      email: ctx.user.email,
    },
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      rating: 1500,
    },
  };
})
```

## Game Server APIs

### Game Room

#### `game-server/src/rooms/GameRoom.ts`

**Room Creation**
```typescript
onCreate(options: CreateOptions) {
  this.setState(new GameState());
  
  this.state.gameId = options.gameId || this.roomId;
  this.state.mapWidth = options.mapWidth || 20;
  this.state.mapHeight = options.mapHeight || 20;
  
  this.setMetadata({
    gameId: this.state.gameId,
    mapWidth: this.state.mapWidth,
    mapHeight: this.state.mapHeight,
    maxPlayers: options.maxPlayers || 4,
  });
  
  // Set up message handlers
  this.onMessage(ClientMessageType.PLAYER_READY, this.handlePlayerReady.bind(this));
  this.onMessage(ClientMessageType.UNIT_ACTION, this.handleUnitAction.bind(this));
  this.onMessage(ClientMessageType.END_TURN, this.handleEndTurn.bind(this));
  this.onMessage(ClientMessageType.CHAT_MESSAGE, this.handleChatMessage.bind(this));
}
```

**Player Join**
```typescript
onJoin(client: Client, options: JoinOptions) {
  // Prevent joining if game is in progress
  if (this.state.status === GameStatus.IN_PROGRESS) {
    client.send(ServerMessageType.ERROR, {
      message: 'Game already in progress',
      code: 'GAME_IN_PROGRESS',
    });
    client.leave();
    return;
  }
  
  // Create new player
  const player = new Player();
  player.id = options.userId;
  player.username = options.username;
  player.color = this.getPlayerColor(this.state.players.size);
  
  this.state.players.set(client.sessionId, player);
  this.playerOrder.push(client.sessionId);
  
  // Send welcome message
  client.send(ServerMessageType.PLAYER_JOINED, {
    playerId: player.id,
    username: player.username,
    playerCount: this.state.players.size,
  });
  
  // Broadcast to others
  this.broadcast(ServerMessageType.PLAYER_JOINED, {
    playerId: player.id,
    username: player.username,
    playerCount: this.state.players.size,
  }, { except: client });
}
```

**Player Leave**
```typescript
onLeave(client: Client, consented: boolean) {
  const player = this.state.players.get(client.sessionId);
  if (player) {
    player.isActive = false;
    
    this.broadcast(ServerMessageType.PLAYER_LEFT, {
      playerId: player.id,
      username: player.username,
    });
    
    // Remove player if room is still in waiting state
    if (this.state.status === GameStatus.WAITING) {
      this.state.players.delete(client.sessionId);
      
      // Remove from player order
      const index = this.playerOrder.indexOf(client.sessionId);
      if (index > -1) {
        this.playerOrder.splice(index, 1);
      }
    } else {
      // Handle player leaving during game
      const playerIndex = this.playerOrder.indexOf(client.sessionId);
      if (playerIndex > -1) {
        // Adjust current player index if needed
        if (playerIndex < this.state.currentPlayerIndex) {
          this.state.currentPlayerIndex--;
        } else if (playerIndex === this.state.currentPlayerIndex) {
          // Current player left, skip to next
          this.advanceToNextPlayer();
        }
        
        // Remove from order
        this.playerOrder.splice(playerIndex, 1);
        
        // Remove player's units
        const unitsToRemove: string[] = [];
        this.state.units.forEach((unit, unitId) => {
          if (unit.playerId === player.id) {
            unitsToRemove.push(unitId);
          }
        });
        unitsToRemove.forEach(unitId => {
          this.state.units.delete(unitId);
        });
      }
    }
  }
}
```

**Message Handlers**

**Player Ready**
```typescript
private handlePlayerReady(client: Client, message: any) {
  const player = this.state.players.get(client.sessionId);
  if (!player) return;
  
  player.isReady = true;
  
  // Check if all players are ready
  const allReady = Array.from(this.state.players.values()).every(p => p.isReady);
  if (allReady && this.state.players.size >= 2) {
    setTimeout(() => this.startGame(), 2000);
  }
}
```

**Unit Action**
```typescript
private handleUnitAction(client: Client, action: UnitAction) {
  if (!this.isPlayerTurn(client.sessionId)) {
    client.send(ServerMessageType.ERROR, {
      message: 'Not your turn',
      code: 'NOT_YOUR_TURN',
    });
    return;
  }
  
  const unit = this.state.units.get(action.unitId);
  if (!unit || unit.playerId !== this.state.players.get(client.sessionId)?.id) {
    client.send(ServerMessageType.ERROR, {
      message: 'Invalid unit',
      code: 'INVALID_UNIT',
    });
    return;
  }
  
  switch (action.type) {
    case 'move':
      if (action.targetPosition) {
        this.handleUnitMove(unit, action.targetPosition);
      }
      break;
    case 'attack':
      if (action.targetUnitId) {
        this.handleUnitAttack(unit, action.targetUnitId);
      }
      break;
  }
}
```

**End Turn**
```typescript
private handleEndTurn(client: Client) {
  if (!this.isPlayerTurn(client.sessionId)) {
    client.send(ServerMessageType.ERROR, {
      message: 'Not your turn',
      code: 'NOT_YOUR_TURN',
    });
    return;
  }
  
  this.advanceToNextPlayer();
  
  this.broadcast(ServerMessageType.TURN_CHANGED, {
    currentPlayerIndex: this.state.currentPlayerIndex,
    currentPlayerId: this.playerOrder[this.state.currentPlayerIndex],
  });
}
```

## Shared Types

### Game Types

#### `shared/src/types/game.ts`

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
  players: string[]; // player IDs
  winner?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameSettings {
  mapId: string;
  maxPlayers: number;
  turnTimeLimit?: number; // seconds
  isPrivate: boolean;
}
```

### Map Types

#### `shared/src/types/map.ts`

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

### Unit Types

#### `shared/src/types/unit.ts`

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

### Player Types

#### `shared/src/types/player.ts`

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

### Network Types

#### `shared/src/types/network.ts`

```typescript
// Client to Server messages
export interface ClientMessage {
  type: ClientMessageType;
  payload: any;
}

export enum ClientMessageType {
  JOIN_GAME = 'join_game',
  LEAVE_GAME = 'leave_game',
  PLAYER_READY = 'player_ready',
  UNIT_ACTION = 'unit_action',
  END_TURN = 'end_turn',
  CHAT_MESSAGE = 'chat_message'
}

// Server to Client messages
export interface ServerMessage {
  type: ServerMessageType;
  payload: any;
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

## State Management

### Auth Store

#### `client/src/stores/authStore.ts`

```typescript
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

**Features:**
- Persistent authentication state
- Automatic token management
- User session handling

## Usage Examples

### Client-Side API Usage

#### Authentication
```typescript
import { trpc } from '../providers/TrpcProvider';
import { useAuthStore } from '../stores/authStore';

function LoginComponent() {
  const loginMutation = trpc.auth.login.useMutation();
  const { login } = useAuthStore();

  const handleLogin = async (username: string, password: string) => {
    try {
      const result = await loginMutation.mutateAsync({ username, password });
      login(result.user, result.token);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleLogin(username, password);
    }}>
      {/* Form fields */}
    </form>
  );
}
```

#### Game Management
```typescript
function GameLobby() {
  const gamesQuery = trpc.game.list.useQuery();
  const createGameMutation = trpc.game.create.useMutation();
  const joinGameMutation = trpc.game.join.useMutation();

  const handleCreateGame = async (mapId: string, settings: GameSettings) => {
    try {
      const game = await createGameMutation.mutateAsync({
        mapId,
        settings,
      });
      // Navigate to game
    } catch (error) {
      console.error('Failed to create game:', error);
    }
  };

  const handleJoinGame = async (gameId: string) => {
    try {
      await joinGameMutation.mutateAsync({ gameId });
      // Navigate to game
    } catch (error) {
      console.error('Failed to join game:', error);
    }
  };

  return (
    <div>
      {gamesQuery.data?.map(game => (
        <div key={game.id}>
          <h3>{game.map.name}</h3>
          <p>Players: {game.players.length}/{game.settings.maxPlayers}</p>
          <button onClick={() => handleJoinGame(game.id)}>
            Join Game
          </button>
        </div>
      ))}
    </div>
  );
}
```

#### Map Management
```typescript
function MapSelector() {
  const mapsQuery = trpc.map.list.useQuery();
  const createMapMutation = trpc.map.create.useMutation();

  const handleCreateMap = async (mapData: CreateMapInput) => {
    try {
      const map = await createMapMutation.mutateAsync(mapData);
      console.log('Map created:', map);
    } catch (error) {
      console.error('Failed to create map:', error);
    }
  };

  return (
    <div>
      {mapsQuery.data?.map(map => (
        <div key={map.id}>
          <h3>{map.name}</h3>
          <p>Size: {map.width}x{map.height}</p>
          <p>Max Players: {map.maxPlayers}</p>
        </div>
      ))}
    </div>
  );
}
```

### Server-Side API Usage

#### Custom tRPC Procedure
```typescript
// Example of creating a custom protected procedure
const customProcedure = protectedProcedure
  .input(z.object({
    gameId: z.string(),
    action: z.enum(['start', 'pause', 'resume']),
  }))
  .mutation(async ({ ctx, input }) => {
    // Verify user has permission to modify this game
    const game = await ctx.db.query.games.findFirst({
      where: eq(games.id, input.gameId),
      with: { players: true },
    });

    if (!game) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Game not found',
      });
    }

    // Check if user is the game creator or has admin rights
    const isCreator = game.players.some(p => 
      p.userId === ctx.user.id && p.playerIndex === 0
    );

    if (!isCreator) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only game creator can perform this action',
      });
    }

    // Perform the action
    switch (input.action) {
      case 'start':
        // Start game logic
        break;
      case 'pause':
        // Pause game logic
        break;
      case 'resume':
        // Resume game logic
        break;
    }

    return { success: true };
  });
```

### Game Server Usage

#### Connecting to Game Room
```typescript
import { Client } from 'colyseus.js';

const client = new Client('ws://localhost:2567');

async function joinGame(gameId: string, userId: string, username: string) {
  try {
    const room = await client.joinById(gameId, {
      gameId,
      userId,
      username,
    });

    // Listen for game state updates
    room.onMessage(ServerMessageType.GAME_STATE_UPDATE, (message) => {
      console.log('Game state updated:', message);
    });

    // Listen for player events
    room.onMessage(ServerMessageType.PLAYER_JOINED, (message) => {
      console.log('Player joined:', message);
    });

    // Send player ready signal
    room.send(ClientMessageType.PLAYER_READY);

    return room;
  } catch (error) {
    console.error('Failed to join game:', error);
  }
}
```

#### Sending Unit Actions
```typescript
function sendUnitAction(room: any, unitId: string, action: UnitAction) {
  room.send(ClientMessageType.UNIT_ACTION, {
    unitId,
    type: action.type,
    targetPosition: action.targetPosition,
    targetUnitId: action.targetUnitId,
  });
}

// Example usage
sendUnitAction(room, 'unit-123', {
  unitId: 'unit-123',
  type: 'move',
  targetPosition: { x: 5, y: 3, z: 0 },
});

sendUnitAction(room, 'unit-123', {
  unitId: 'unit-123',
  type: 'attack',
  targetUnitId: 'enemy-unit-456',
});
```

## Error Handling

### tRPC Error Types
```typescript
// Common error codes used throughout the API
enum ErrorCodes {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  BAD_REQUEST = 'BAD_REQUEST',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}
```

### Client-Side Error Handling
```typescript
function useApiError() {
  const handleError = (error: any) => {
    if (error.data?.code === 'UNAUTHORIZED') {
      // Redirect to login
      window.location.href = '/login';
    } else if (error.data?.code === 'NOT_FOUND') {
      // Show not found message
      console.error('Resource not found');
    } else {
      // Show generic error
      console.error('An error occurred:', error.message);
    }
  };

  return { handleError };
}
```

## Best Practices

### API Design
1. **Consistent Error Handling**: All APIs return structured errors with codes and messages
2. **Input Validation**: Use Zod schemas for all input validation
3. **Authentication**: Use JWT tokens with automatic injection
4. **Type Safety**: Full TypeScript support across client and server

### Performance
1. **Batch Requests**: tRPC supports batch requests for multiple operations
2. **Caching**: React Query provides automatic caching and background updates
3. **WebSocket Optimization**: Colyseus handles efficient real-time communication

### Security
1. **JWT Authentication**: Secure token-based authentication
2. **Input Sanitization**: Zod schemas prevent malicious input
3. **CORS Configuration**: Proper cross-origin request handling
4. **Protected Routes**: Server-side validation for all sensitive operations

This documentation provides a comprehensive overview of all public APIs, functions, and components in the turn-based strategy game. Each section includes detailed examples and usage instructions to help developers understand and implement the functionality effectively.