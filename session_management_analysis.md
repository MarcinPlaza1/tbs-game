# Analiza Session Management i Rekomendacje Ulepszenia

## Obecny Stan Session Management

### Architektura Sesji

System składa się z trzech głównych warstw zarządzania sesjami:

1. **Warstwa Autoryzacji (Server)** - JWT + Refresh Tokens
2. **Warstwa Gry (Game Server)** - Colyseus WebSocket Sessions
3. **Warstwa Klienta** - Zustand Store z persistencją

### Obecne Komponenty

#### 1. Authentication Server (`server/src/trpc/routers/auth.ts`)
```typescript
// Aktualne podejście
const generateTokenPair = (userId: string) => {
  const accessToken = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = generateRefreshToken();
  const refreshTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dni
  return { accessToken, refreshToken, refreshTokenExpiresAt };
};
```

#### 2. Game Session Management (`game-server/src/rooms/GameRoom.ts`)
```typescript
// Zarządzanie graczami w pokoju
onJoin(client: Client, options: JoinOptions) {
  const player = new Player();
  player.id = options.userId;
  player.username = options.username;
  this.state.players.set(client.sessionId, player);
  this.playerOrder.push(client.sessionId);
}
```

#### 3. Client Session Store (`client/src/stores/authStore.ts`)
```typescript
// Zustand store z persistencją
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      // ...
    }),
    { name: 'auth-storage' }
  )
);
```

## Zidentyfikowane Problemy

### 🔴 Krytyczne Problemy

#### 1. **Brak Korelacji Między Sesjami**
- **Problem**: Sesje HTTP (auth) i WebSocket (game) działają niezależnie
- **Konsekwencje**: Brak synchronizacji stanu, możliwość duplikacji graczy
- **Lokalizacja**: Brak połączenia między `auth.ts` i `GameRoom.ts`

#### 2. **Słaba Walidacja Dostępu do Pokoju**
```typescript
// Obecnie w GameRoom.ts
onJoin(client: Client, options: JoinOptions) {
  // Brak weryfikacji czy userId jest rzeczywiście zalogowany
  const player = new Player();
  player.id = options.userId; // Można podać dowolne userId!
}
```

#### 3. **Brak Mechanizmu Session Hijacking Protection**
- Brak bindowania IP do sesji
- Brak detekcji podejrzanej aktywności
- Brak invalidacji sesji przy zmianie hasła

#### 4. **Nieefektywne Zarządzanie Stanem Gracza**
```typescript
// Problem: Gracz może być w kilku pokojach jednocześnie
this.state.players.set(client.sessionId, player);
// Brak sprawdzenia czy gracz już jest w innym pokoju
```

### 🟡 Problemy Średniej Wagi

#### 1. **Rate Limiting Tylko w Pamięci**
```typescript
// simpleRateLimit.ts - dane tylko w pamięci
const rateLimitStore = new Map<string, RateLimitEntry>();
// Restart serwera = reset limitów
```

#### 2. **Brak Session Monitoring**
- Brak logowania aktywności sesji
- Brak metryki czasu sesji
- Brak detekcji zombie sessions

#### 3. **Primitive Session Storage**
```typescript
// Tylko podstawowe informacje w bazie
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
// Brak metadata: IP, user agent, lokalizacja, etc.
```

## Rekomendacje Ulepszenia

### 1. **Unified Session Management System**

#### Nowa Architektura Sesji

```typescript
// Nowa tabela: unified_sessions
export const unifiedSessions = pgTable('unified_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  sessionToken: text('session_token').notNull().unique(),
  refreshToken: text('refresh_token').notNull().unique(),
  gameSessionId: text('game_session_id'), // Colyseus session ID
  currentGameRoomId: text('current_game_room_id'),
  
  // Security metadata
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  deviceFingerprint: text('device_fingerprint'),
  
  // Session state
  status: varchar('status', { length: 20 }).default('active'), // active, inactive, expired, revoked
  lastActivity: timestamp('last_activity').defaultNow(),
  
  // Timing
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

#### Unified Session Manager

```typescript
// src/session/UnifiedSessionManager.ts
export class UnifiedSessionManager {
  private static instance: UnifiedSessionManager;
  private activeSessions = new Map<string, SessionInfo>();
  
  static getInstance(): UnifiedSessionManager {
    if (!this.instance) {
      this.instance = new UnifiedSessionManager();
    }
    return this.instance;
  }
  
  async createSession(userId: string, metadata: SessionMetadata): Promise<SessionTokens> {
    // 1. Sprawdź limity sesji per user
    await this.enforceSessionLimits(userId);
    
    // 2. Generuj tokeny
    const sessionToken = this.generateSessionToken();
    const refreshToken = this.generateRefreshToken();
    
    // 3. Zapisz w bazie i pamięci
    const session = await this.storeSession({
      userId,
      sessionToken,
      refreshToken,
      ...metadata
    });
    
    // 4. Zaplanuj cleanup
    this.scheduleSessionCleanup(sessionToken);
    
    return { sessionToken, refreshToken, expiresAt: session.expiresAt };
  }
  
  async validateSession(sessionToken: string): Promise<SessionInfo | null> {
    const session = this.activeSessions.get(sessionToken);
    if (!session) return null;
    
    // Sprawdź expiry
    if (session.expiresAt < new Date()) {
      await this.revokeSession(sessionToken);
      return null;
    }
    
    // Update last activity
    await this.updateLastActivity(sessionToken);
    
    return session;
  }
  
  async linkGameSession(sessionToken: string, gameSessionId: string, roomId: string): Promise<void> {
    const session = await this.validateSession(sessionToken);
    if (!session) throw new Error('Invalid session');
    
    // Sprawdź czy gracz nie jest już w innym pokoju
    if (session.currentGameRoomId && session.currentGameRoomId !== roomId) {
      throw new Error('Player already in another game room');
    }
    
    // Link session
    await this.updateSession(sessionToken, {
      gameSessionId,
      currentGameRoomId: roomId
    });
  }
  
  async revokeSession(sessionToken: string): Promise<void> {
    const session = this.activeSessions.get(sessionToken);
    if (session) {
      // Wyloguj z gry jeśli aktywna
      if (session.gameSessionId) {
        await this.disconnectFromGame(session.gameSessionId);
      }
      
      // Usuń z pamięci i bazy
      this.activeSessions.delete(sessionToken);
      await this.deleteSessionFromDB(sessionToken);
    }
  }
  
  private async enforceSessionLimits(userId: string): Promise<void> {
    const userSessions = await this.getUserActiveSessions(userId);
    const MAX_SESSIONS_PER_USER = 3;
    
    if (userSessions.length >= MAX_SESSIONS_PER_USER) {
      // Usuń najstarszą sesję
      const oldestSession = userSessions.sort((a, b) => 
        a.lastActivity.getTime() - b.lastActivity.getTime()
      )[0];
      
      await this.revokeSession(oldestSession.sessionToken);
    }
  }
}
```

### 2. **Enhanced Game Room Authentication**

```typescript
// Enhanced GameRoom.ts
export class GameRoom extends Room<GameState> {
  private sessionManager = UnifiedSessionManager.getInstance();
  
  async onAuth(client: Client, options: JoinOptions): Promise<boolean> {
    try {
      // 1. Waliduj session token
      const session = await this.sessionManager.validateSession(options.sessionToken);
      if (!session) {
        client.send(ServerMessageType.ERROR, { message: 'Invalid session' });
        return false;
      }
      
      // 2. Sprawdź czy gracz nie jest już w innym pokoju
      if (session.currentGameRoomId && session.currentGameRoomId !== this.roomId) {
        client.send(ServerMessageType.ERROR, { message: 'Already in another game' });
        return false;
      }
      
      // 3. Sprawdź czy gra pozwala na dołączenie
      if (this.state.status !== GameStatus.WAITING) {
        client.send(ServerMessageType.ERROR, { message: 'Game in progress' });
        return false;
      }
      
      // 4. Link session z grą
      await this.sessionManager.linkGameSession(
        options.sessionToken,
        client.sessionId,
        this.roomId
      );
      
      // 5. Attach user data do klienta
      client.userData = {
        userId: session.userId,
        username: session.username,
        sessionToken: options.sessionToken
      };
      
      return true;
    } catch (error) {
      console.error('Authentication failed:', error);
      return false;
    }
  }
  
  onJoin(client: Client, options: JoinOptions) {
    // Teraz mamy pewność że klient jest zautentyfikowany
    const player = new Player();
    player.id = client.userData.userId;
    player.username = client.userData.username;
    
    this.state.players.set(client.sessionId, player);
    this.playerOrder.push(client.sessionId);
    
    console.log(`✅ Authenticated player ${client.userData.username} joined`);
  }
  
  async onLeave(client: Client, consented: boolean) {
    // Cleanup session linkage
    if (client.userData?.sessionToken) {
      await this.sessionManager.unlinkGameSession(client.userData.sessionToken);
    }
    
    // Existing leave logic...
  }
}
```

### 3. **Advanced Session Security**

#### Session Anomaly Detection

```typescript
// src/session/SessionAnomalyDetector.ts
export class SessionAnomalyDetector {
  async detectAnomalies(sessionToken: string, currentRequest: RequestInfo): Promise<AnomalyReport> {
    const session = await this.getSession(sessionToken);
    if (!session) return { anomalies: [], riskScore: 0 };
    
    const anomalies: Anomaly[] = [];
    let riskScore = 0;
    
    // 1. IP Address Change Detection
    if (session.ipAddress !== currentRequest.ip) {
      const geoChange = await this.checkGeographicDistance(session.ipAddress, currentRequest.ip);
      if (geoChange.distance > 1000) { // 1000km
        anomalies.push({
          type: 'GEOGRAPHIC_ANOMALY',
          description: `IP change from ${session.ipAddress} to ${currentRequest.ip}`,
          riskScore: 7
        });
        riskScore += 7;
      }
    }
    
    // 2. User Agent Change
    if (session.userAgent !== currentRequest.userAgent) {
      anomalies.push({
        type: 'USER_AGENT_CHANGE',
        description: 'User agent changed',
        riskScore: 3
      });
      riskScore += 3;
    }
    
    // 3. Unusual Activity Pattern
    const activityPattern = await this.analyzeActivityPattern(session.userId);
    if (activityPattern.isUnusual) {
      anomalies.push({
        type: 'UNUSUAL_ACTIVITY',
        description: 'Activity pattern differs from normal',
        riskScore: 4
      });
      riskScore += 4;
    }
    
    // 4. Concurrent Session Detection
    const concurrentSessions = await this.getConcurrentSessions(session.userId);
    if (concurrentSessions.length > 2) {
      anomalies.push({
        type: 'MULTIPLE_CONCURRENT_SESSIONS',
        description: `${concurrentSessions.length} concurrent sessions detected`,
        riskScore: 5
      });
      riskScore += 5;
    }
    
    return { anomalies, riskScore };
  }
  
  async handleAnomalies(sessionToken: string, anomalies: AnomalyReport): Promise<void> {
    if (anomalies.riskScore >= 10) {
      // High risk - revoke session and require re-authentication
      await this.sessionManager.revokeSession(sessionToken);
      await this.notifyUser(sessionToken, 'SECURITY_ALERT', 'Suspicious activity detected');
    } else if (anomalies.riskScore >= 5) {
      // Medium risk - require additional verification
      await this.requireAdditionalVerification(sessionToken);
    }
    
    // Log all anomalies
    await this.logSecurityEvent(sessionToken, anomalies);
  }
}
```

### 4. **Session Persistence and Recovery**

```typescript
// src/session/SessionPersistence.ts
export class SessionPersistence {
  async saveGameState(sessionToken: string, gameState: any): Promise<void> {
    const session = await this.getSession(sessionToken);
    if (!session) return;
    
    // Zapisz stan gry w Redis lub DB
    await this.redis.hset(`game_state:${session.userId}`, {
      gameRoomId: session.currentGameRoomId,
      playerState: JSON.stringify(gameState),
      lastSaved: new Date().toISOString()
    });
  }
  
  async recoverGameState(sessionToken: string): Promise<any> {
    const session = await this.getSession(sessionToken);
    if (!session) return null;
    
    const savedState = await this.redis.hgetall(`game_state:${session.userId}`);
    if (!savedState.playerState) return null;
    
    return {
      gameRoomId: savedState.gameRoomId,
      playerState: JSON.parse(savedState.playerState),
      lastSaved: new Date(savedState.lastSaved)
    };
  }
  
  async handleReconnection(sessionToken: string): Promise<ReconnectionInfo> {
    const session = await this.getSession(sessionToken);
    if (!session) throw new Error('Invalid session');
    
    // Sprawdź czy gracz był w grze
    if (session.currentGameRoomId) {
      const gameState = await this.recoverGameState(sessionToken);
      if (gameState) {
        return {
          canReconnect: true,
          gameRoomId: session.currentGameRoomId,
          savedState: gameState
        };
      }
    }
    
    return { canReconnect: false };
  }
}
```

### 5. **Client-Side Session Management Enhancement**

```typescript
// Enhanced authStore.ts
interface AuthState {
  user: User | null;
  sessionToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionStatus: 'active' | 'inactive' | 'expired' | 'anomaly';
  lastActivity: Date | null;
  
  // Methods
  login: (user: User, sessionToken: string, refreshToken: string) => void;
  logout: () => void;
  refreshSession: () => Promise<void>;
  handleSessionAnomaly: (anomaly: string) => void;
  updateActivity: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      sessionToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true,
      sessionStatus: 'inactive',
      lastActivity: null,
      
      login: (user, sessionToken, refreshToken) => {
        set({ 
          user, 
          sessionToken, 
          refreshToken, 
          isAuthenticated: true, 
          isLoading: false,
          sessionStatus: 'active',
          lastActivity: new Date()
        });
        
        // Start session monitoring
        get().startSessionMonitoring();
      },
      
      logout: () => {
        const { sessionToken } = get();
        if (sessionToken) {
          // Notify server about logout
          fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sessionToken}` }
          });
        }
        
        set({ 
          user: null, 
          sessionToken: null, 
          refreshToken: null, 
          isAuthenticated: false, 
          isLoading: false,
          sessionStatus: 'inactive',
          lastActivity: null
        });
      },
      
      refreshSession: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return;
        
        try {
          const response = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
          
          if (response.ok) {
            const data = await response.json();
            set({
              sessionToken: data.sessionToken,
              refreshToken: data.refreshToken,
              sessionStatus: 'active',
              lastActivity: new Date()
            });
          } else {
            get().logout();
          }
        } catch (error) {
          get().logout();
        }
      },
      
      handleSessionAnomaly: (anomaly: string) => {
        set({ sessionStatus: 'anomaly' });
        // Show security warning to user
        console.warn('Session anomaly detected:', anomaly);
      },
      
      updateActivity: () => {
        set({ lastActivity: new Date() });
      },
      
      startSessionMonitoring: () => {
        // Monitor session every 30 seconds
        setInterval(() => {
          const { sessionToken, lastActivity } = get();
          if (sessionToken && lastActivity) {
            const timeSinceActivity = Date.now() - lastActivity.getTime();
            if (timeSinceActivity > 30 * 60 * 1000) { // 30 minutes
              get().refreshSession();
            }
          }
        }, 30000);
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        sessionToken: state.sessionToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
```

### 6. **Session Monitoring Dashboard**

```typescript
// src/admin/SessionMonitor.tsx
export const SessionMonitorDashboard: React.FC = () => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [metrics, setMetrics] = useState<SessionMetrics>();
  
  useEffect(() => {
    const fetchSessions = async () => {
      const response = await fetch('/api/admin/sessions');
      const data = await response.json();
      setSessions(data.sessions);
      setMetrics(data.metrics);
    };
    
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);
  
  const revokeSession = async (sessionToken: string) => {
    await fetch('/api/admin/sessions/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken })
    });
  };
  
  return (
    <div className="session-monitor">
      <h1>Session Monitor</h1>
      
      <div className="metrics">
        <div className="metric">
          <h3>Active Sessions</h3>
          <span>{metrics?.activeSessions || 0}</span>
        </div>
        <div className="metric">
          <h3>Game Sessions</h3>
          <span>{metrics?.gameSessions || 0}</span>
        </div>
        <div className="metric">
          <h3>Anomalies Detected</h3>
          <span>{metrics?.anomalies || 0}</span>
        </div>
      </div>
      
      <div className="sessions-table">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>IP Address</th>
              <th>Status</th>
              <th>Game Room</th>
              <th>Last Activity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((session) => (
              <tr key={session.sessionToken}>
                <td>{session.username}</td>
                <td>{session.ipAddress}</td>
                <td>
                  <span className={`status ${session.status}`}>
                    {session.status}
                  </span>
                </td>
                <td>{session.currentGameRoomId || 'None'}</td>
                <td>{session.lastActivity.toLocaleString()}</td>
                <td>
                  <button 
                    onClick={() => revokeSession(session.sessionToken)}
                    className="btn-danger"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

## Plan Implementacji

### Faza 1: Podstawowe Ulepszenia (1-2 tygodnie)
1. ✅ Implementacja `UnifiedSessionManager`
2. ✅ Dodanie metadanych sesji do bazy danych
3. ✅ Ulepszona walidacja w `GameRoom`
4. ✅ Persistent rate limiting w bazie danych

### Faza 2: Bezpieczeństwo (2-3 tygodnie)
1. ✅ `SessionAnomalyDetector`
2. ✅ IP binding i geolocation tracking
3. ✅ Session cleanup i monitoring
4. ✅ Enhanced client-side session management

### Faza 3: Monitoring i Recovery (1-2 tygodnie)
1. ✅ Session persistence system
2. ✅ Reconnection handling
3. ✅ Admin dashboard
4. ✅ Session analytics

### Faza 4: Optymalizacja (1 tydzień)
1. ✅ Performance optimization
2. ✅ Caching strategies
3. ✅ Load balancing considerations
4. ✅ Documentation

## Korzyści z Implementacji

### Bezpieczeństwo
- 🔒 Unified session management eliminuje luki bezpieczeństwa
- 🔒 Anomaly detection zapobiega session hijacking
- 🔒 Proper session cleanup zapobiega zombie sessions

### Funkcjonalność
- 🎮 Seamless reconnection do gier
- 🎮 Prevention of duplicate players
- 🎮 Better game state persistence

### Monitorowanie
- 📊 Real-time session analytics
- 📊 Security event logging
- 📊 Performance metrics

### Skalowalność
- 🚀 Horizontal scaling support
- 🚀 Database-backed rate limiting
- 🚀 Efficient session storage

## Podsumowanie

Obecny system session management ma solidne podstawy, ale wymaga znaczących ulepszeń w zakresie bezpieczeństwa, funkcjonalności i monitorowania. Proponowane rozwiązania wprowadzają unified session management, który eliminuje obecne problemy i wprowadza nowoczesne funkcje bezpieczeństwa.

Kluczowe ulepszenia:
1. **Unified Session Management** - jedna sesja dla auth i game
2. **Enhanced Security** - anomaly detection i session monitoring
3. **Better UX** - seamless reconnection i state recovery
4. **Admin Tools** - comprehensive monitoring dashboard

Implementacja tego systemu znacznie poprawi bezpieczeństwo, niezawodność i doświadczenie użytkownika w grze.