import { Room, Client } from 'colyseus';
import jwt from 'jsonwebtoken';
import { GameState, Player, Unit, Position as ColyseusPosition } from '../schemas/GameState';
import { 
  ClientMessageType, 
  UnitAction,
  GameStatus,
  GamePhase,
  UnitType,
  ServerMessageType,
  Position
} from '@tbs/shared';
import { env } from '../config/env';
import { db } from '../db/client';
import { games, activeGameSessions } from '../db/schema';
import { eq, and } from 'drizzle-orm';

interface JoinOptions {
  gameId: string;
  token?: string;
  userId?: string;
  username?: string;
  playerData?: any;
}

interface CreateOptions {
  gameId?: string;
  mapWidth?: number;
  mapHeight?: number;
  maxPlayers?: number;
}

export class GameRoom extends Room<GameState> {
  maxClients = 8;
  private playerOrder: string[] = []; // Maintain consistent player order
  private authenticatedUsers: Map<string, { userId: string; username: string }> = new Map();
  private userIdToSessionId: Map<string, string> = new Map(); // Track userId -> sessionId mapping
  private gameId: string = ''; // Store game ID for DB operations
  private lastSaveTime: number = 0; // Track last save time
  
  async onAuth(client: Client, options: JoinOptions) {
    console.log('🔐 Authenticating client:', client.sessionId);
    
    try {
      // Get token from query parameters or options
      const token = options.token || client.auth?.token;
      
      if (!token) {
        console.log('❌ No token provided');
        return false;
      }
      
      // Verify JWT token
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      
      // Validate token structure
      if (!decoded || typeof decoded !== 'object' || !decoded.userId || typeof decoded.userId !== 'string') {
        console.log('❌ Invalid token structure');
        return false;
      }
      
      // Store authenticated user data
      this.authenticatedUsers.set(client.sessionId, {
        userId: decoded.userId,
        username: decoded.username || `Player_${decoded.userId.slice(0, 8)}`,
      });
      
      console.log('✅ Client authenticated:', decoded.userId);
      return true;
      
    } catch (error) {
      console.log('❌ Authentication failed:', error.message);
      return false;
    }
  }

      async onCreate(options: CreateOptions) {
    console.log('🏠 Creating GameRoom with options:', options);
    
    this.setState(new GameState());
    
    // Enable reconnection with 30 second window
    this.allowReconnection(30);
    
    // Set initial game state
    this.state.gameId = options.gameId || this.roomId;
    this.gameId = this.state.gameId;
    this.state.mapWidth = options.mapWidth || 20;
    this.state.mapHeight = options.mapHeight || 20;
    
    // Try to load existing game state from DB
    const stateLoaded = await this.loadGameState();
    if (stateLoaded) {
      console.log('✅ Game state loaded from DB');
    } else {
      console.log('🆕 Starting with fresh game state');
    }
    
    console.log('✅ GameRoom created successfully for gameId:', this.state.gameId);
    console.log('📊 Initial state set:', {
      gameId: this.state.gameId,
      status: this.state.status,
      phase: this.state.phase,
      mapWidth: this.state.mapWidth,
      mapHeight: this.state.mapHeight,
      playersCount: this.state.players.size
    });
    
    // Set room metadata for matchmaking
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
    
    console.log('✅ Game room created:', this.roomId, 'for game:', this.state.gameId);
  }
  
  async onJoin(client: Client, options: JoinOptions) {
    // Get authenticated user data
    const authData = this.authenticatedUsers.get(client.sessionId);
    if (!authData) {
      console.log('❌ No authenticated data for client:', client.sessionId);
      client.send(ServerMessageType.ERROR, {
        message: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED',
      });
      client.leave();
      return;
    }
    
    console.log('👤 Player joining:', client.sessionId, authData.username, 'Game ID:', options.gameId);
    
    // Check if this is a reconnection
    const previousSessionId = this.userIdToSessionId.get(authData.userId);
    const isReconnection = previousSessionId && this.state.players.has(previousSessionId);
    
    if (isReconnection) {
      console.log('🔄 Player reconnecting:', authData.username);
      
      // Update session mapping
      this.userIdToSessionId.set(authData.userId, client.sessionId);
      
      // Get existing player data
      const existingPlayer = this.state.players.get(previousSessionId);
      if (existingPlayer) {
        // Transfer player data to new session
        this.state.players.set(client.sessionId, existingPlayer);
        this.state.players.delete(previousSessionId);
        
        // Update player order
        const orderIndex = this.playerOrder.indexOf(previousSessionId);
        if (orderIndex > -1) {
          this.playerOrder[orderIndex] = client.sessionId;
        }
        
        // Mark player as active again
        existingPlayer.isActive = true;
        
        console.log('✅ Player reconnected successfully:', authData.username);
      }
    } else {
      // New player joining
      // Prevent joining if game is in progress and not a reconnection
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
      player.id = authData.userId;
      player.username = authData.username;
      player.color = this.getPlayerColor(this.state.players.size);
      
      this.state.players.set(client.sessionId, player);
      
      // Add to player order for consistent turn management
      this.playerOrder.push(client.sessionId);
      
      // Track userId -> sessionId mapping
      this.userIdToSessionId.set(authData.userId, client.sessionId);
      
      // Update active session in DB
      await this.updateActiveSession(authData.userId, client.sessionId);
    }
    
    console.log(`✅ Player ${authData.username} joined room. Total players: ${this.state.players.size}`);
    console.log('🎲 Current game state:', {
      gameId: this.state.gameId,
      status: this.state.status,
      phase: this.state.phase,
      playersCount: this.state.players.size,
      mapSize: `${this.state.mapWidth}x${this.state.mapHeight}`
    });
    
    // Send welcome message
    client.send(ServerMessageType.PLAYER_JOINED, {
      playerId: player.id,
      username: player.username,
      playerCount: this.state.players.size,
    });
    
    // Send state update to this client only
    console.log('🔄 Sending state update to new client...');
    setTimeout(() => {
      console.log('📤 Sending state update to', player.username);
      client.send('manual_state_update', {
        gameId: this.state.gameId,
        status: this.state.status,
        phase: this.state.phase,
        playersCount: this.state.players.size,
        players: Array.from(this.state.players.values()).map(p => ({
          id: p.id,
          username: p.username,
          color: p.color,
          isReady: p.isReady
        }))
      });
    }, 100);
    
    // Broadcast to others
    this.broadcast(ServerMessageType.PLAYER_JOINED, {
      playerId: player.id,
      username: player.username,
      playerCount: this.state.players.size,
    }, { except: client });
    
    // Auto-start disabled - players must click Ready
    // if (this.state.players.size >= 1 && this.state.status === GameStatus.WAITING) {
    //   console.log('🎮 Auto-starting game with', this.state.players.size, 'players');
    //   setTimeout(() => this.startGame(), 1000);
    // }
  }
  
  async onLeave(client: Client, consented: boolean) {
    console.log('👋 Player left:', client.sessionId, 'consented:', consented);
    
    // Clean up authenticated user data
    this.authenticatedUsers.delete(client.sessionId);
    
    const player = this.state.players.get(client.sessionId);
    if (player) {
      // Mark player as inactive but don't remove immediately (allow reconnection)
      player.isActive = false;
      
      console.log('⏳ Player marked as inactive, allowing reconnection:', player.username);
      
      // Only remove player if they explicitly left (consented = true) or if room is in waiting state
      if (consented || this.state.status === GameStatus.WAITING) {
        console.log('🗑️ Removing player permanently:', player.username);
        
        // Clean up user mapping
        this.userIdToSessionId.delete(player.id);
        
        this.broadcast(ServerMessageType.PLAYER_LEFT, {
          playerId: player.id,
          username: player.username,
        });
        
        this.state.players.delete(client.sessionId);
        
        // Remove from player order
        const index = this.playerOrder.indexOf(client.sessionId);
        if (index > -1) {
          this.playerOrder.splice(index, 1);
        }
        
        // If game is in progress, handle player leaving during game
        if (this.state.status === GameStatus.IN_PROGRESS) {
          const playerIndex = this.playerOrder.indexOf(client.sessionId);
          if (playerIndex > -1) {
            // Adjust current player index if needed
            if (playerIndex < this.state.currentPlayerIndex) {
              this.state.currentPlayerIndex--;
            } else if (playerIndex === this.state.currentPlayerIndex) {
              // Current player left, skip to next
              await this.advanceToNextPlayer();
            }
            
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
      } else {
        // Player disconnected but didn't explicitly leave - allow reconnection
        this.broadcast(ServerMessageType.PLAYER_LEFT, {
          playerId: player.id,
          username: player.username,
          temporary: true, // Indicate this is a temporary disconnection
        });
      }
    }
  }
  
  private handlePlayerReady(client: Client, message: any) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      console.log('❌ Player not found for ready signal:', client.sessionId);
      return;
    }
    
    console.log('✅ Player ready:', player.username);
    player.isReady = true;
    
    // Broadcast updated state immediately
    console.log('📤 Sending updated state after ready');
    this.broadcast('manual_state_update', {
      gameId: this.state.gameId,
      status: this.state.status,
      phase: this.state.phase,
      playersCount: this.state.players.size,
      players: Array.from(this.state.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        color: p.color,
        isReady: p.isReady
      }))
    });
    
    // Check if all players are ready
    let allReady = true;
    this.state.players.forEach(p => {
      if (!p.isReady) allReady = false;
    });
    
    if (allReady && this.state.players.size >= 1) {
      console.log('🎮 All players ready, starting game...');
      this.startGame();
    }
  }
  
  private handleUnitAction(client: Client, action: UnitAction) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !this.isPlayerTurn(client.sessionId)) {
      client.send(ServerMessageType.ERROR, {
        message: 'Not your turn',
        code: 'NOT_YOUR_TURN',
      });
      return;
    }
    
    const unit = this.state.units.get(action.unitId);
    if (!unit || unit.playerId !== player.id) {
      client.send(ServerMessageType.ERROR, {
        message: 'Invalid unit',
        code: 'INVALID_UNIT',
      });
      return;
    }
    
    console.log('🎯 Processing unit action:', action.type, 'for unit:', action.unitId);
    
    // Process action based on type
    switch (action.type) {
      case 'move':
        this.handleUnitMove(unit, action.targetPosition!);
        break;
      case 'attack':
        this.handleUnitAttack(unit, action.targetUnitId!);
        break;
    }
    
    // Broadcast action result with updated game state
    this.broadcast(ServerMessageType.UNIT_ACTION_RESULT, {
      type: action.type,
      unitId: action.unitId,
      success: true,
      gameState: this.getGameStateForClient()
    });
  }
  
  private handleUnitMove(unit: Unit, targetPosition: Position) {
    if (unit.hasMoved) return;
    
    console.log('🚶 Moving unit to:', targetPosition);
    // Simple movement - just update position
    // In real game, check path, terrain, etc.
    unit.position.x = targetPosition.x;
    unit.position.y = targetPosition.y;
    unit.hasMoved = true;
  }
  
  private handleUnitAttack(unit: Unit, targetUnitId: string) {
    if (unit.hasAttacked) return;
    
    const targetUnit = this.state.units.get(targetUnitId);
    if (!targetUnit) return;
    
    console.log('⚔️ Unit attacking:', unit.id, '->', targetUnitId);
    
    // Simple combat calculation
    const damage = Math.max(1, unit.attack - targetUnit.defense);
    targetUnit.health -= damage;
    
    if (targetUnit.health <= 0) {
      console.log('💀 Unit defeated:', targetUnitId);
      targetUnit.isAlive = false;
      this.state.units.delete(targetUnitId);
    }
    
    unit.hasAttacked = true;
  }
  
  private async handleEndTurn(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !this.isPlayerTurn(client.sessionId)) return;
    
    console.log('🔄 Ending turn for player:', player.username);
    
    // Reset unit states for current player
    this.state.units.forEach(unit => {
      if (unit.playerId === player.id) {
        unit.hasMoved = false;
        unit.hasAttacked = false;
      }
    });
    
    // Advance to next player
    await this.advanceToNextPlayer();
  }

  private async advanceToNextPlayer() {
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.playerOrder.length;
    this.state.turnNumber++;
    
    const currentSessionId = this.playerOrder[this.state.currentPlayerIndex];
    const currentPlayer = this.state.players.get(currentSessionId);
    
    if (currentPlayer) {
      currentPlayer.actionPoints = 3;
      
      console.log('🔄 Turn advanced to:', currentPlayer.username, 'Turn:', this.state.turnNumber);
      
      this.broadcast(ServerMessageType.TURN_CHANGED, {
        currentPlayerIndex: this.state.currentPlayerIndex,
        turnNumber: this.state.turnNumber,
        currentPlayer: currentPlayer.id,
        currentPlayerName: currentPlayer.username,
        gameState: this.getGameStateForClient()
      });
      
      // Save game state after turn change
      await this.saveGameState();
    }
  }
  
  private handleChatMessage(client: Client, message: string) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    
    console.log('💬 Chat message from', player.username, ':', message);
    
    this.broadcast(ServerMessageType.CHAT_MESSAGE, {
      playerId: player.id,
      username: player.username,
      message,
      timestamp: Date.now(),
    });
  }
  
  private async startGame() {
    console.log('🎮 Starting game with', this.state.players.size, 'players');
    
    this.state.status = GameStatus.IN_PROGRESS;
    this.state.phase = GamePhase.BATTLE;
    this.state.currentPlayerIndex = 0;
    this.state.turnNumber = 1;
    
    // Spawn initial units for each player in order
    this.playerOrder.forEach((sessionId, playerIndex) => {
      const player = this.state.players.get(sessionId);
      if (player) {
        this.spawnUnitsForPlayer(player, playerIndex);
        console.log('⚔️ Spawned units for player:', player.username, 'at index:', playerIndex);
      }
    });
    
    // Set first player's action points
    const firstSessionId = this.playerOrder[0];
    const firstPlayer = this.state.players.get(firstSessionId);
    if (firstPlayer) {
      firstPlayer.actionPoints = 3;
    }
    
    this.broadcast(ServerMessageType.GAME_STARTED, {
      gameId: this.state.gameId,
      currentPlayer: firstPlayer?.id,
      currentPlayerName: firstPlayer?.username,
    });
    
    // Send complete game state after start
    console.log('📤 Sending complete game state after start');
    this.broadcast('manual_state_update', this.getGameStateForClient());
    
    console.log('✅ Game started successfully! Turn order:', this.playerOrder.map(sessionId => {
      const player = this.state.players.get(sessionId);
      return player?.username;
    }));
    
    // Save game state after starting
    await this.saveGameState();
  }
  
  private spawnUnitsForPlayer(player: Player, playerIndex: number) {
    // Spawn 3 units per player at corners/sides of map
    let spawnX: number, spawnY: number;
    
    switch (playerIndex) {
      case 0: // Top-left
        spawnX = 1;
        spawnY = 1;
        break;
      case 1: // Top-right
        spawnX = this.state.mapWidth - 4;
        spawnY = 1;
        break;
      case 2: // Bottom-left
        spawnX = 1;
        spawnY = this.state.mapHeight - 4;
        break;
      case 3: // Bottom-right
        spawnX = this.state.mapWidth - 4;
        spawnY = this.state.mapHeight - 4;
        break;
      default: // Additional players in middle edges
        spawnX = playerIndex % 2 === 0 ? 1 : this.state.mapWidth - 4;
        spawnY = Math.floor(this.state.mapHeight / 2) - 1;
        break;
    }
    
    const unitTypes = [UnitType.WARRIOR, UnitType.ARCHER, UnitType.MAGE];
    
    for (let i = 0; i < 3; i++) {
      const unit = new Unit();
      unit.id = `${player.id}_unit_${i}`;
      unit.playerId = player.id;
      unit.type = unitTypes[i];
      
      const pos = new ColyseusPosition();
      pos.x = spawnX + i;
      pos.y = spawnY;
      pos.z = 0;
      unit.position = pos;
      
      // Set unit stats based on type
      switch (unit.type) {
        case UnitType.WARRIOR:
          unit.maxHealth = unit.health = 150;
          unit.attack = 20;
          unit.defense = 10;
          unit.movement = 3;
          unit.range = 1;
          break;
        case UnitType.ARCHER:
          unit.maxHealth = unit.health = 80;
          unit.attack = 15;
          unit.defense = 5;
          unit.movement = 4;
          unit.range = 3;
          break;
        case UnitType.MAGE:
          unit.maxHealth = unit.health = 60;
          unit.attack = 25;
          unit.defense = 3;
          unit.movement = 2;
          unit.range = 2;
          break;
      }
      
      this.state.units.set(unit.id, unit);
      console.log('🛡️ Spawned', unit.type, 'for', player.username, 'at', pos.x, pos.y);
    }
  }
  
  private isPlayerTurn(sessionId: string): boolean {
    if (this.state.status !== GameStatus.IN_PROGRESS) return false;
    
    const currentSessionId = this.playerOrder[this.state.currentPlayerIndex];
    return currentSessionId === sessionId;
  }

  private getGameStateForClient() {
    return {
      gameId: this.state.gameId,
      status: this.state.status,
      phase: this.state.phase,
      turnNumber: this.state.turnNumber,
      currentPlayerIndex: this.state.currentPlayerIndex,
      mapWidth: this.state.mapWidth,
      mapHeight: this.state.mapHeight,
      players: this.getPlayersData(),
      units: this.getUnitsData(),
    };
  }

  private getPlayersData() {
    const playersData: any = {};
    this.state.players.forEach((player, sessionId) => {
      playersData[player.id] = {
        id: player.id,
        username: player.username,
        color: player.color,
        isReady: player.isReady,
        isActive: player.isActive,
        actionPoints: player.actionPoints,
        isCurrentPlayer: this.isPlayerTurn(sessionId)
      };
    });
    return playersData;
  }

  private getUnitsData() {
    const unitsData = new Map();
    this.state.units.forEach((unit, unitId) => {
      unitsData.set(unitId, {
        id: unit.id,
        playerId: unit.playerId,
        type: unit.type,
        position: {
          x: unit.position.x,
          y: unit.position.y,
          z: unit.position.z
        },
        health: unit.health,
        maxHealth: unit.maxHealth,
        attack: unit.attack,
        defense: unit.defense,
        movement: unit.movement,
        range: unit.range,
        hasMoved: unit.hasMoved,
        hasAttacked: unit.hasAttacked,
        isAlive: unit.isAlive
      });
    });
    return unitsData;
  }
  
  private getPlayerColor(index: number): string {
    const colors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'];
    return colors[index % colors.length];
  }

  // Serialize game state for DB persistence
  private serializeGameState() {
    const players: any = {};
    this.state.players.forEach((player, sessionId) => {
      players[sessionId] = {
        id: player.id,
        username: player.username,
        color: player.color,
        isReady: player.isReady,
        isActive: player.isActive,
        actionPoints: player.actionPoints,
      };
    });

    const units: any = {};
    this.state.units.forEach((unit, unitId) => {
      units[unitId] = {
        id: unit.id,
        playerId: unit.playerId,
        type: unit.type,
        position: {
          x: unit.position.x,
          y: unit.position.y,
          z: unit.position.z,
        },
        health: unit.health,
        maxHealth: unit.maxHealth,
        attack: unit.attack,
        defense: unit.defense,
        movement: unit.movement,
        range: unit.range,
        hasMoved: unit.hasMoved,
        hasAttacked: unit.hasAttacked,
        isAlive: unit.isAlive,
      };
    });

    return {
      gameId: this.state.gameId,
      status: this.state.status,
      phase: this.state.phase,
      currentPlayerIndex: this.state.currentPlayerIndex,
      turnNumber: this.state.turnNumber,
      mapWidth: this.state.mapWidth,
      mapHeight: this.state.mapHeight,
      players,
      units,
      playerOrder: this.playerOrder,
      userIdToSessionId: Object.fromEntries(this.userIdToSessionId),
      timestamp: Date.now(),
    };
  }

  // Deserialize game state from DB
  private deserializeGameState(serializedState: any) {
    if (!serializedState) return false;

    try {
      console.log('🔄 Deserializing game state from DB');
      
      // Restore basic game state
      this.state.gameId = serializedState.gameId;
      this.state.status = serializedState.status;
      this.state.phase = serializedState.phase;
      this.state.currentPlayerIndex = serializedState.currentPlayerIndex;
      this.state.turnNumber = serializedState.turnNumber;
      this.state.mapWidth = serializedState.mapWidth;
      this.state.mapHeight = serializedState.mapHeight;

      // Restore players
      this.state.players.clear();
      Object.entries(serializedState.players).forEach(([sessionId, playerData]: [string, any]) => {
        const player = new Player();
        player.id = playerData.id;
        player.username = playerData.username;
        player.color = playerData.color;
        player.isReady = playerData.isReady;
        player.isActive = playerData.isActive;
        player.actionPoints = playerData.actionPoints;
        this.state.players.set(sessionId, player);
      });

      // Restore units
      this.state.units.clear();
      Object.entries(serializedState.units).forEach(([unitId, unitData]: [string, any]) => {
        const unit = new Unit();
        unit.id = unitData.id;
        unit.playerId = unitData.playerId;
        unit.type = unitData.type;
        
        const pos = new ColyseusPosition();
        pos.x = unitData.position.x;
        pos.y = unitData.position.y;
        pos.z = unitData.position.z;
        unit.position = pos;
        
        unit.health = unitData.health;
        unit.maxHealth = unitData.maxHealth;
        unit.attack = unitData.attack;
        unit.defense = unitData.defense;
        unit.movement = unitData.movement;
        unit.range = unitData.range;
        unit.hasMoved = unitData.hasMoved;
        unit.hasAttacked = unitData.hasAttacked;
        unit.isAlive = unitData.isAlive;
        
        this.state.units.set(unitId, unit);
      });

      // Restore internal state
      this.playerOrder = serializedState.playerOrder || [];
      this.userIdToSessionId = new Map(Object.entries(serializedState.userIdToSessionId || {}));

      console.log('✅ Game state restored successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to deserialize game state:', error);
      return false;
    }
  }

  // Save game state to DB
  private async saveGameState() {
    if (!this.gameId) return;

    try {
      const serializedState = this.serializeGameState();
      
      await db.update(games)
        .set({
          status: this.state.status,
          phase: this.state.phase,
          currentPlayerIndex: this.state.currentPlayerIndex,
          turnNumber: this.state.turnNumber,
          gameState: serializedState,
          lastStateUpdate: new Date(),
          colyseusRoomId: this.roomId,
        })
        .where(eq(games.id, this.gameId));

      this.lastSaveTime = Date.now();
      console.log('💾 Game state saved to DB');
    } catch (error) {
      console.error('❌ Failed to save game state:', error);
    }
  }

  // Load game state from DB
  private async loadGameState(): Promise<boolean> {
    if (!this.gameId) return false;

    try {
      const gameData = await db.query.games.findFirst({
        where: eq(games.id, this.gameId),
      });

      if (gameData?.gameState) {
        return this.deserializeGameState(gameData.gameState);
      }
      
      return false;
    } catch (error) {
      console.error('❌ Failed to load game state:', error);
      return false;
    }
  }

  // Update active game session
  private async updateActiveSession(userId: string, sessionId: string) {
    try {
      // First try to update existing session
      const existingSession = await db.query.activeGameSessions.findFirst({
        where: and(
          eq(activeGameSessions.userId, userId),
          eq(activeGameSessions.gameId, this.gameId)
        ),
      });

      if (existingSession) {
        // Update existing session
        await db.update(activeGameSessions)
          .set({
            sessionId,
            lastActivity: new Date(),
            isActive: true,
          })
          .where(eq(activeGameSessions.id, existingSession.id));
      } else {
        // Create new session
        await db.insert(activeGameSessions).values({
          userId,
          gameId: this.gameId,
          colyseusRoomId: this.roomId,
          sessionId,
          lastActivity: new Date(),
        });
      }
    } catch (error) {
      console.error('❌ Failed to update active session:', error);
    }
  }
} 