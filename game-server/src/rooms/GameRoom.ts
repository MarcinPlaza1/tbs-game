import { Room, Client } from 'colyseus';
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

interface JoinOptions {
  gameId: string;
  userId: string;
  username: string;
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
  
  onCreate(options: CreateOptions) {
    console.log('🏠 Creating GameRoom with options:', options);
    
    this.setState(new GameState());
    
    // Set initial game state
    this.state.gameId = options.gameId || this.roomId;
    this.state.mapWidth = options.mapWidth || 20;
    this.state.mapHeight = options.mapHeight || 20;
    
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
  
  onJoin(client: Client, options: JoinOptions) {
    console.log('👤 Player joining:', client.sessionId, options.username, 'Game ID:', options.gameId);
    
    // Create new player
    const player = new Player();
    player.id = options.userId;
    player.username = options.username;
    player.color = this.getPlayerColor(this.state.players.size);
    
    this.state.players.set(client.sessionId, player);
    
    console.log(`✅ Player ${options.username} joined room. Total players: ${this.state.players.size}`);
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
  
  onLeave(client: Client, consented: boolean) {
    console.log('👋 Player left:', client.sessionId, 'consented:', consented);
    
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
    if (!player || !this.isPlayerTurn(player)) {
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
    
    // Broadcast action result
    this.broadcast(ServerMessageType.UNIT_ACTION_RESULT, {
      action,
      success: true,
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
  
  private handleEndTurn(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !this.isPlayerTurn(player)) return;
    
    console.log('🔄 Ending turn for player:', player.username);
    
    // Reset unit states
    this.state.units.forEach(unit => {
      if (unit.playerId === player.id) {
        unit.hasMoved = false;
        unit.hasAttacked = false;
      }
    });
    
    // Move to next player
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.size;
    this.state.turnNumber++;
    
    // Reset action points for next player
    const players = Array.from(this.state.players.values());
    const nextPlayer = players[this.state.currentPlayerIndex];
    if (nextPlayer) {
      nextPlayer.actionPoints = 3;
    }
    
    this.broadcast(ServerMessageType.TURN_CHANGED, {
      currentPlayerIndex: this.state.currentPlayerIndex,
      turnNumber: this.state.turnNumber,
      currentPlayer: nextPlayer?.username,
    });
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
  
  private startGame() {
    console.log('🎮 Starting game with', this.state.players.size, 'players');
    
    this.state.status = GameStatus.IN_PROGRESS;
    this.state.phase = GamePhase.BATTLE;
    this.state.currentPlayerIndex = 0;
    this.state.turnNumber = 1;
    
    // Spawn initial units for each player
    let playerIndex = 0;
    this.state.players.forEach((player, sessionId) => {
      this.spawnUnitsForPlayer(player, playerIndex);
      console.log('⚔️ Spawned units for player:', player.username);
      playerIndex++;
    });
    
    // Set first player's action points
    const firstPlayer = Array.from(this.state.players.values())[0];
    if (firstPlayer) {
      firstPlayer.actionPoints = 3;
    }
    
    this.broadcast(ServerMessageType.GAME_STARTED, {
      gameId: this.state.gameId,
      currentPlayer: firstPlayer?.username,
    });
    
    // Send updated game state after start
    console.log('📤 Sending game state after start');
    this.broadcast('manual_state_update', {
      gameId: this.state.gameId,
      status: this.state.status,
      phase: this.state.phase,
      playersCount: this.state.players.size,
      turnNumber: this.state.turnNumber,
      players: Array.from(this.state.players.values()).map(p => ({
        id: p.id,
        username: p.username,
        color: p.color,
        isReady: p.isReady
      }))
    });
    
    console.log('✅ Game started successfully!');
  }
  
  private spawnUnitsForPlayer(player: Player, playerIndex: number) {
    // Spawn 3 units per player at start
    const spawnX = playerIndex < 2 ? 2 : this.state.mapWidth - 3;
    const spawnY = playerIndex % 2 === 0 ? 2 : this.state.mapHeight - 3;
    
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
  
  private isPlayerTurn(player: Player): boolean {
    const players = Array.from(this.state.players.values());
    return players[this.state.currentPlayerIndex]?.id === player.id;
  }
  
  private getPlayerColor(index: number): string {
    const colors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'];
    return colors[index % colors.length];
  }
} 