import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client, Room } from 'colyseus.js';
import { GameEngine } from '../game/babylon/GameEngine';
import { useAuthStore } from '../stores/authStore';
import { trpc } from '../providers/TrpcProvider';
import { ClientMessageType } from '@tbs/shared';

function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const roomRef = useRef<Room | null>(null);
  const initializingRef = useRef<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [chatInput, setChatInput] = useState('');
  
  // Unified log system for chat and events
  interface GameLogEntry {
    id: string;
    type: 'chat' | 'system' | 'player_event' | 'game_event' | 'action' | 'debug';
    timestamp: number;
    message: string;
    username?: string;
    metadata?: any;
  }
  
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const gameLogRef = useRef<HTMLDivElement>(null);
  
  // Enhanced logging function
  const addGameLog = (
    type: GameLogEntry['type'], 
    message: string, 
    username?: string, 
    metadata?: any
  ) => {
    const logEntry: GameLogEntry = {
      id: Date.now().toString() + Math.random().toString(36),
      type,
      timestamp: Date.now(),
      message,
      username,
      metadata
    };
    
    setGameLog(prev => [...prev.slice(-99), logEntry]); // Keep last 100 entries
    
    // Auto-scroll to bottom
    setTimeout(() => {
      if (gameLogRef.current) {
        gameLogRef.current.scrollTop = gameLogRef.current.scrollHeight;
      }
    }, 100);
    
    // Also add to connection log for debugging
    if (type === 'debug' || type === 'system') {
      addLog(message);
    }
  };
  const [connectionLog, setConnectionLog] = useState<string[]>([]);
  
  // Loading states
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  const [isGameReady, setIsGameReady] = useState(false);
  const [gameActivated, setGameActivated] = useState(false);
  const [showUI, setShowUI] = useState(true);
  
  const { data: gameData } = trpc.game.get.useQuery({ gameId: gameId! });

  const addLog = (message: string) => {
    console.log(message);
    setConnectionLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const attemptReconnection = async (gameName?: string) => {
    try {
      const displayName = gameName || gameData?.map?.name || 'the game';
      addLog('🔄 Reconnecting to game...');
      
      const client = new Client('ws://localhost:2567');
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const room = await client.joinOrCreate('game_room', {
        gameId: gameId,
        token: token,
      });
      
      roomRef.current = room;
      addLog('✅ Reconnected successfully!');
      addGameLog('system', `Reconnected to "${displayName}" successfully!`, 'System', {
        event: 'reconnection_success'
      });
      
      // Reconnect room to game engine
      if (engineRef.current && user) {
        engineRef.current.setRoom(room);
        engineRef.current.setCurrentPlayerId(user.id);
      }
      
      // Re-setup event handlers
      setupRoomEventHandlers(room);
      
    } catch (error: any) {
      const displayName = gameName || gameData?.map?.name || 'the game';
      addLog(`❌ Reconnection failed: ${error.message}`);
      addGameLog('system', `Failed to reconnect to "${displayName}": ${error.message}`, 'System', {
        event: 'reconnection_failed'
      });
      setTimeout(() => {
        attemptReconnection(gameName);
      }, 5000); // Try again in 5 seconds
         }
   };

  const setupRoomEventHandlers = (room: Room) => {
    // Set up room event handlers
    room.onStateChange((state: any) => {
      addLog(`🔄 Game state updated - Players: ${Object.keys(state.players || {}).length}, Status: ${state.status}`);
      console.log('Full game state:', state);
      setGameState(state);
      
      // Update game engine with real state
      if (engineRef.current) {
        try {
          engineRef.current.updateGameState(state);
        } catch (error: any) {
          addLog(`⚠️ GameEngine update failed: ${error.message}`);
        }
      }
    });

    room.onMessage('player_joined', (message) => {
      addLog(`👤 Player joined: ${message.username}`);
      addGameLog('player_event', `${message.username} joined the game`, 'System', {
        playerId: message.playerId,
        event: 'join'
      });
    });

    room.onMessage('player_left', (message) => {
      const status = message.temporary ? 'disconnected' : 'left';
      addLog(`👋 Player ${status}: ${message.username}`);
      addGameLog('player_event', `${message.username} ${status} the game`, 'System', {
        playerId: message.playerId,
        event: 'leave'
      });
    });

    room.onMessage('game_started', (message) => {
      addLog(`🎉 Game started! Current player: ${message.currentPlayer}`);
      addGameLog('game_event', `Game started! Current player: ${message.currentPlayer}`, 'System', {
        currentPlayer: message.currentPlayer,
        event: 'game_start'
      });
    });

    room.onMessage('turn_changed', (message) => {
      addLog(`🔄 Turn changed to player ${message.currentPlayer} (Turn ${message.turnNumber})`);
      
      const isMyTurn = message.currentPlayer === user?.id;
      addGameLog('game_event',
        isMyTurn ? `It's your turn! (Turn ${message.turnNumber})` : `Turn ${message.turnNumber}: ${message.currentPlayerName}'s turn`,
        'System',
        {
          currentPlayer: message.currentPlayer,
          turnNumber: message.turnNumber,
          isMyTurn,
          event: 'turn_change'
        }
      );

      // Handle turn change
      handleTurnChange(message, isMyTurn);
      
      // Show turn notification
      if (isMyTurn) {
        addLog(`🎯 It's your turn!`);
      } else {
        addLog(`⏳ Waiting for player ${message.currentPlayer}...`);
      }
    });

    room.onMessage('manual_state_update', (message) => {
      const readyPlayers = message.players && Array.isArray(message.players) ? message.players.filter((p: any) => p.isReady).length : 0;
      addLog(`📥 Manual state update - Players: ${message.playersCount}, Ready: ${readyPlayers}, Status: ${message.status}`);
      
      // Create a fake gameState for testing
      const fakeState: any = {
        gameId: message.gameId,
        status: message.status,
        phase: message.phase,
        mapWidth: 20,
        mapHeight: 20,
        players: {},
        units: new Map(),
        turnNumber: message.turnNumber || 1,
        currentPlayerIndex: 0
      };
      
      // Add players with detailed logging
      if (message.players && Array.isArray(message.players)) {
        message.players.forEach((player: any) => {
          fakeState.players[player.id] = player;
          addLog(`👤 Player state: ${player.username} - Ready: ${player.isReady}`);
        });
      } else if (message.players) {
        addLog(`⚠️ Received players data but it's not an array: ${typeof message.players}`);
      }
      
      setGameState(fakeState);
      
      // Update game engine with manual state
      if (engineRef.current) {
        try {
          engineRef.current.updateGameState(fakeState);
        } catch (error: any) {
          addLog(`⚠️ GameEngine manual update failed: ${error.message}`);
        }
      }
    });

    room.onMessage('chat_message', (message) => {
      addLog(`💬 Chat: ${message.username}: ${message.message}`);
      addGameLog('chat', message.message, message.username, {
        timestamp: message.timestamp,
        received: true
      });
    });

    room.onMessage('unit_action_result', (message) => {
      addLog(`🎯 Unit action result: ${message.type} - ${message.success ? 'Success' : 'Failed'}`);
      
      if (message.success) {
        addGameLog('action',
          `✅ ${message.type.charAt(0).toUpperCase() + message.type.slice(1)} successful`,
          user?.username || 'Player',
          {
            action: message.type,
            success: true,
            unitId: message.unitId
          }
        );
      }
    });

    room.onMessage('action_failed', (message) => {
      addLog(`❌ Action failed: ${message.reason}`);
      addGameLog('action',
        `❌ Action failed: ${message.reason}`,
        user?.username || 'Player',
        {
          action: message.action,
          success: false,
          reason: message.reason
        }
      );
    });

    room.onMessage('error', (message) => {
      addLog(`❌ Room error: ${message.message}`);
      addGameLog('system', `Error: ${message.message}`, 'System', {
        code: message.code,
        event: 'error'
      });
    });

    room.onLeave((code) => {
      addLog(`👋 Left room with code: ${code}`);
      
      // If disconnected unexpectedly, try to reconnect
      if (code !== 1000) { // 1000 = normal closure
        const displayName = gameData?.map?.name;
        addLog(`🔄 Attempting to reconnect to "${displayName || 'the game'}"...`);
        setTimeout(() => {
          attemptReconnection(displayName);
        }, 2000);
      } else {
        navigate('/lobby');
      }
    });

    room.onError((code, message) => {
      addLog(`🚫 Room error: ${code} - ${message}`);
      setError(`Connection error: ${message}`);
    });
  };

  // Simulate loading process
  const simulateLoading = async () => {
    const stages = [
      { stage: 'Initializing 3D Engine...', progress: 10, delay: 800 },
      { stage: 'Loading Babylon.js Components...', progress: 25, delay: 600 },
      { stage: 'Setting up Scene...', progress: 40, delay: 700 },
      { stage: 'Loading Game Map...', progress: 60, delay: 900 },
      { stage: 'Generating Terrain...', progress: 75, delay: 600 },
      { stage: 'Loading Game Assets...', progress: 90, delay: 500 },
      { stage: 'Finalizing...', progress: 100, delay: 400 }
    ];

    for (const { stage, progress, delay } of stages) {
      setLoadingStage(stage);
      setLoadingProgress(progress);
      addLog(`🔄 ${stage}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    setIsGameReady(true);
    addLog('✅ Game engine fully loaded and ready!');
  };

  useEffect(() => {
    if (!user || !gameId || roomRef.current || initializingRef.current) return; // Prevent multiple initializations
    
    // Add initial welcome message to game log
    const gameName = gameData?.map?.name || 'Unknown Map';
    addGameLog('system', `Welcome to the game! Connecting to "${gameName}"...`, 'System', {
      gameId,
      userId: user.id,
      event: 'connection_start'
    });
    
    initializingRef.current = true;
    
    // Small delay to ensure canvas is rendered
    const timer = setTimeout(() => {
      initializeGame();
    }, 100);

    const initializeGame = async () => {
      try {
        addLog('🎮 Initializing game connection...');
        addLog(`📊 Game ID: ${gameId}`);
        addLog(`👤 User: ${user.username} (${user.id})`);

        // Start loading simulation
        await simulateLoading();

        // Initialize Babylon.js engine (in background during simulation)
        try {
          if (canvasRef.current) {
            addLog('🎨 Preparing Babylon.js engine...');
            engineRef.current = new GameEngine(canvasRef.current);
            // Don't initialize yet - wait for Ready
            addLog('✅ Babylon.js engine prepared (waiting for activation)');
          } else {
            addLog('⚠️ Canvas not ready, will retry on activation');
          }
        } catch (error: any) {
          addLog(`⚠️ Babylon.js preparation failed: ${error.message}`);
          engineRef.current = null;
        }

        // Connect to Colyseus
        addLog('🌐 Connecting to Colyseus server...');
        const client = new Client('ws://localhost:2567');
        
        // Check if we have authentication token
        if (!token) {
          throw new Error('No authentication token found');
        }
        
        addLog('🏠 Attempting to join/create room...');
        const room = await client.joinOrCreate('game_room', {
          gameId: gameId,
          token: token, // Pass JWT token for authentication
        });
        
        roomRef.current = room;
        addLog(`✅ Connected to game room: ${room.id}`);
        
        // Add to game log
        addGameLog('system', `Connected to "${gameName}" successfully!`, 'System', {
          roomId: room.id,
          event: 'connection_success'
        });

        // Connect room to game engine if ready
        if (engineRef.current && user) {
          engineRef.current.setRoom(room);
          engineRef.current.setCurrentPlayerId(user.id);
          addLog('🔗 Connected room to game engine');
        }

        // Set up room event handlers
        setupRoomEventHandlers(room);



        setIsLoading(false);
        addLog('🎉 Game connection established successfully!');
      } catch (err: any) {
        addLog(`💥 Failed to connect: ${err.message}`);
        setError(`Failed to connect to game: ${err.message}`);
        setIsLoading(false);
      }
    };

    return () => {
      clearTimeout(timer);
      initializingRef.current = false;
      addLog('🧹 Cleaning up game connection...');
      if (engineRef.current) {
        engineRef.current.dispose();
      }
      if (roomRef.current) {
        roomRef.current.leave();
      }
    };
  }, [gameId, user?.id]); // Dependencies should remain stable

  const sendChatMessage = () => {
    if (chatInput.trim() && roomRef.current && user) {
      roomRef.current.send('chat_message', chatInput);
      
      // Add to unified log immediately (optimistic update)
      addGameLog('chat', chatInput, user.username, {
        timestamp: Date.now(),
        sent: true
      });
      
      setChatInput('');
    }
  };

  // Handle complete turn change with state reset
  const handleTurnChange = (message: any, isMyTurn: boolean) => {
    console.log('🔄 Processing turn change...');
    
    // 1. Reset unit selection in GameEngine
    if (engineRef.current) {
      try {
        // Clear any selected unit
        if (engineRef.current.getSelectedUnitId()) {
          engineRef.current.clearUnitSelection();
          addLog('🔄 Cleared unit selection for new turn');
        }
      } catch (error: any) {
        addLog(`⚠️ Error clearing selection: ${error.message}`);
      }
    }
    
    // 2. Update local game state
    if (message.gameState) {
      console.log('🔄 Updating game state from turn change');
      setGameState(message.gameState);
      
      if (engineRef.current) {
        try {
          engineRef.current.updateGameState(message.gameState);
          addLog('✅ Game state updated for new turn');
        } catch (error: any) {
          addLog(`⚠️ GameEngine update failed: ${error.message}`);
        }
      }
    }
    
    // 3. Reset UI and action points for new turn
    if (engineRef.current) {
      try {
        engineRef.current.refreshUnitsForNewTurn();
        addLog('🔄 Units refreshed for new turn');
      } catch (error: any) {
        addLog(`⚠️ Error refreshing units: ${error.message}`);
      }
    }
    
    if (isMyTurn) {
      addLog('🎯 Your turn started - all units refreshed');
      addGameLog('system', 'Your turn - you can now move and act with your units', user?.username, {
        event: 'turn_start_player'
      });
    } else {
      addLog('⏳ Opponent\'s turn - waiting...');
      addGameLog('system', `Waiting for player ${message.currentPlayer}`, 'System', {
        event: 'turn_start_opponent',
        currentPlayer: message.currentPlayer
      });
    }
  };

  const handleEndTurn = () => {
    if (roomRef.current && user) {
      // Disable further actions during turn transition
      addLog('🔄 Ending turn...');
      
      // Send end turn message
      roomRef.current.send(ClientMessageType.END_TURN, {
        playerId: user.id
      });
      
      // Add to game log
      addGameLog('action', `Ended turn`, user.username, {
        event: 'end_turn'
      });
      
      // Clear current selection immediately for better UX
      if (engineRef.current) {
        try {
          // Clear selection on turn end
                     if (engineRef.current.getSelectedUnitId()) {
             engineRef.current.clearUnitSelection();
           }
        } catch (error: any) {
          console.warn('Error clearing selection on turn end:', error.message);
        }
      }
    }
  };

  // Helper functions for log styling
  const getLogEntryStyle = (type: GameLogEntry['type']): string => {
    switch (type) {
      case 'chat':
        return 'bg-blue-900 bg-opacity-30 border-l-2 border-blue-500';
      case 'player_event':
        return 'bg-green-900 bg-opacity-30 border-l-2 border-green-500';
      case 'game_event':
        return 'bg-purple-900 bg-opacity-30 border-l-2 border-purple-500';
      case 'action':
        return 'bg-yellow-900 bg-opacity-30 border-l-2 border-yellow-500';
      case 'system':
        return 'bg-gray-900 bg-opacity-30 border-l-2 border-gray-500';
      case 'debug':
        return 'bg-red-900 bg-opacity-20 border-l-2 border-red-500';
      default:
        return 'bg-gray-800 bg-opacity-30';
    }
  };

  const getMessageStyle = (type: GameLogEntry['type']): string => {
    switch (type) {
      case 'chat':
        return 'text-white';
      case 'player_event':
        return 'text-green-300';
      case 'game_event':
        return 'text-purple-300';
      case 'action':
        return 'text-yellow-300';
      case 'system':
        return 'text-gray-300';
      case 'debug':
        return 'text-red-300';
      default:
        return 'text-gray-300';
    }
  };

  const getEventIcon = (event: string): string => {
    switch (event) {
      case 'join':
        return '👤';
      case 'leave':
        return '👋';
      case 'game_start':
        return '🎉';
      case 'turn_change':
        return '🔄';
      case 'unit_action_success':
        return '✅';
      case 'unit_action_failed':
        return '❌';
      default:
        return '📝';
    }
  };

  const getCurrentPlayerName = (gameState: any): string => {
    if (!gameState || !gameState.players) return 'Unknown';
    
    // Find current player by isCurrentPlayer flag
    const currentPlayer = Object.values(gameState.players).find((player: any) => player.isCurrentPlayer);
    if (currentPlayer) {
      return (currentPlayer as any).username;
    }
    
    // Fallback: use currentPlayerIndex
    const playersArray = Object.values(gameState.players);
    const currentIndex = gameState.currentPlayerIndex || 0;
    if (playersArray[currentIndex]) {
      return (playersArray[currentIndex] as any).username;
    }
    
    return 'Unknown';
  };

  const getUnitTypeIcon = (unitType: string): string => {
    switch (unitType?.toLowerCase()) {
      case 'warrior':
        return '⚔️';
      case 'archer':
        return '🏹';
      case 'mage':
        return '🔮';
      case 'cavalry':
        return '🐎';
      case 'siege':
        return '🏰';
      default:
        return '🛡️';
    }
  };

  const handlePlayerReady = async () => {
    if (!roomRef.current || !isGameReady) return;
    
    addLog('🎮 Activating game...');
    
    // Activate the game engine
    try {
      if (engineRef.current && canvasRef.current) {
        addLog('⚡ Initializing 3D engine...');
        
        // Ensure room connection is established
        if (roomRef.current && user) {
          engineRef.current.setRoom(roomRef.current);
          engineRef.current.setCurrentPlayerId(user.id);
          addLog('🔗 Connected room to game engine');
        }
        
        await engineRef.current.initialize();
        addLog('✅ 3D engine activated successfully!');
        setGameActivated(true);
        
        // Force resize after canvas becomes visible
        setTimeout(() => {
          if (engineRef.current) {
            window.dispatchEvent(new Event('resize'));
          }
        }, 100);
      } else if (canvasRef.current) {
        // Try to create engine if it wasn't created before
        addLog('🔧 Creating and activating 3D engine...');
        engineRef.current = new GameEngine(canvasRef.current);
        
        // Connect to room immediately
        if (roomRef.current && user) {
          engineRef.current.setRoom(roomRef.current);
          engineRef.current.setCurrentPlayerId(user.id);
          addLog('🔗 Connected room to game engine');
        }
        
        await engineRef.current.initialize();
        addLog('✅ 3D engine created and activated!');
        setGameActivated(true);
        
        // Force resize after canvas becomes visible
        setTimeout(() => {
          if (engineRef.current) {
            window.dispatchEvent(new Event('resize'));
          }
        }, 100);
      }
    } catch (error: any) {
      addLog(`⚠️ 3D engine activation failed: ${error.message} - continuing with 2D mode`);
      setGameActivated(true); // Still activate game, just without 3D
    }
    
    // Send ready signal to server
    roomRef.current.send('player_ready', {});
    addLog('✅ Player ready signal sent');
    
    // Add to game log
    addGameLog('system', `You are ready to play!`, user?.username || 'Player', {
      event: 'player_ready'
    });
  };

  if (isLoading && !isGameReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-2xl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-game-accent mx-auto mb-4"></div>
          <p className="text-lg">Loading game...</p>
          <p className="text-sm text-gray-400 mt-2">Connecting to game server...</p>
          
          <div className="mt-4 text-left bg-gray-800 p-4 rounded max-h-40 overflow-y-auto">
            <h3 className="font-bold mb-2">Connection Log:</h3>
            {connectionLog.map((log, index) => (
              <div key={index} className="text-xs text-gray-300 font-mono">{log}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card max-w-2xl">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Connection Error</h2>
          <p className="mb-4">{error}</p>
          
          <div className="mb-4 text-left bg-gray-800 p-4 rounded max-h-40 overflow-y-auto">
            <h3 className="font-bold mb-2">Connection Log:</h3>
            {connectionLog.map((log, index) => (
              <div key={index} className="text-xs text-gray-300 font-mono">{log}</div>
            ))}
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => window.location.reload()} className="btn btn-primary">
              Retry
            </button>
            <button onClick={() => navigate('/lobby')} className="btn btn-secondary">
              Back to Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Always Visible Game Controls Bar */}
      <div className="bg-gray-800 px-4 py-2 flex justify-between items-center">
        <div className="flex gap-3">
          <button 
            onClick={handleEndTurn} 
            disabled={!gameActivated || !engineRef.current?.isMyTurn()}
            className={`px-4 py-1 rounded text-sm font-semibold transition-colors ${
              gameActivated && engineRef.current?.isMyTurn()
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-gray-500 cursor-not-allowed text-gray-300'
            }`}
          >
            ⏭️ End Turn
          </button>
        </div>
        
        {/* Compact status info */}
        <div className="text-white text-xs">
          {gameActivated && gameState && (
            <span>{gameState.status} | T:{gameState.turnNumber}</span>
          )}
          {!gameActivated && (
            <span>{isGameReady ? 'Ready' : `${loadingProgress}%`}</span>
          )}
        </div>
      </div>
      
      {/* Main Game Area */}
      <div className="flex flex-1">
        {/* Game Canvas */}
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          <canvas 
            ref={canvasRef} 
            className="max-w-full max-h-full" 
            style={{ 
              display: gameActivated && engineRef.current ? 'block' : 'none',
              width: '800px',
              height: '600px',
              backgroundColor: '#111827' // bg-gray-900 equivalent
            }} 
          />
          
          {/* Loading Screen */}
          {!gameActivated && (
            <div className="absolute inset-0 flex items-center justify-center text-white bg-gray-900">
              <div className="text-center max-w-md">
                <h2 className="text-2xl font-bold mb-6">🗺️ Game Engine Loading</h2>
                
                {/* Loading Progress Bar */}
                <div className="mb-4">
                  <div className="bg-gray-700 rounded-full h-3 mb-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${loadingProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-300">{loadingProgress}% Complete</p>
                </div>
                
                {/* Current Stage */}
                <p className="text-gray-400 mb-4">{loadingStage}</p>
                
                {/* Ready State */}
                {isGameReady ? (
                  <div className="mt-6 p-4 bg-green-900 bg-opacity-50 rounded-lg border border-green-600">
                    <p className="text-green-400 font-semibold">🎮 Game Engine Ready!</p>
                    <p className="text-sm text-gray-300 mt-2">Click "Ready" to activate and join the game</p>
                  </div>
                ) : (
                  <div className="flex justify-center mt-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Game Activated Screen */}
          {gameActivated && !engineRef.current && (
            <div className="absolute inset-0 flex items-center justify-center text-white bg-gray-900">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">🎮 Game Active</h2>
                <p className="text-gray-400">Running in 2D mode</p>
              </div>
            </div>
          )}
          
          {/* UI Toggle Button */}
          <div className="absolute top-4 left-4">
            <button
              onClick={() => setShowUI(!showUI)}
              className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-2 rounded-lg text-xs backdrop-blur-sm transition-all"
              title={showUI ? "Hide UI" : "Show UI"}
            >
              {showUI ? "👁️ Hide UI" : "👁️ Show UI"}
            </button>
          </div>

          {/* Ready Button */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
            <button
              onClick={handlePlayerReady}
              disabled={!isGameReady || gameActivated}
              className={`px-4 py-2 rounded-lg text-sm font-semibold backdrop-blur-sm transition-all ${
                !isGameReady 
                  ? 'bg-gray-700 bg-opacity-60 cursor-not-allowed text-gray-400' 
                  : gameActivated 
                    ? 'bg-green-700 bg-opacity-80 text-green-200'
                    : 'bg-blue-700 bg-opacity-80 hover:bg-blue-600 hover:bg-opacity-90 text-white'
              }`}
              title={
                !isGameReady 
                  ? 'Game engine is loading...' 
                  : gameActivated 
                    ? 'Already ready!' 
                    : 'Click to join the game'
              }
            >
              {gameActivated ? '✅ Ready' : !isGameReady ? '⏳ Loading...' : '🎮 Ready'}
            </button>
          </div>

          {showUI && (
            <>
              {/* Compact Game Info Overlay */}
              <div className="absolute top-4 right-4">
                <div className="bg-black bg-opacity-60 text-white px-3 py-2 rounded-lg text-xs backdrop-blur-sm">
                  {gameState && (
                    <div className="flex gap-4 items-center">
                      <span>Turn: <strong>{gameState.turnNumber || 1}</strong></span>
                      <span>Phase: <strong>{gameState.phase}</strong></span>
                      <span>Current: <strong>{getCurrentPlayerName(gameState)}</strong></span>
                      <span>Players: <strong>{Object.keys(gameState.players || {}).length}</strong></span>
                      <span>Units: <strong>{gameState.units ? gameState.units.size || Array.from(gameState.units.values()).length : 0}</strong></span>
                    </div>
                  )}
                  {engineRef.current && (
                    <div className="mt-1 text-xs text-gray-400">
                      <span>My Turn: <strong className={engineRef.current.isMyTurn() ? 'text-green-400' : 'text-red-400'}>
                        {engineRef.current.isMyTurn() ? 'Yes' : 'No'}
                      </strong></span>
                      {engineRef.current.getSelectedUnitId() && (
                        <span className="ml-2">Selected: <strong className="text-yellow-400">{engineRef.current.getSelectedUnitId()}</strong></span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Debug Panel - collapsible */}
              <div className="absolute bottom-4 right-4">
                <details className="bg-black bg-opacity-60 text-white p-2 rounded text-xs">
                  <summary className="cursor-pointer font-bold">🐛 Debug</summary>
                  <div className="mt-2 max-h-32 overflow-y-auto w-64">
                    {connectionLog.slice(-8).map((log, index) => (
                      <div key={index} className="text-xs text-gray-300 font-mono mb-1">{log}</div>
                    ))}
                  </div>
                </details>
              </div>
            </>
          )}
        </div>

        {/* Sidebar - Hidden for now, will be repositioned when game loads */}
        {false && (
        <div className="w-80 bg-game-secondary flex flex-col">
          {/* Turn Info */}
          {gameState && (
            <div className="p-4 border-b border-gray-700">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold">Turn {gameState.turnNumber || 1}</h3>
                <div className="text-sm text-gray-400">{gameState.phase}</div>
              </div>
              {engineRef.current && (
                <div className={`text-sm p-2 rounded ${
                  engineRef.current!.isMyTurn() 
                    ? 'bg-green-800 text-green-200' 
                    : 'bg-gray-700 text-gray-300'
                }`}>
                  {engineRef.current!.isMyTurn() ? '🎯 Your turn!' : '⏳ Waiting...'}
                </div>
              )}
            </div>
          )}

          {/* Players */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-lg font-bold mb-4">Players</h3>
            <div className="space-y-2">
              {gameState && Object.values(gameState.players || {}).map((player: any) => {
                const isCurrentPlayer = player.isCurrentPlayer || false;
                const isMe = player.id === user?.id;
                const unitCount = gameState.units ? 
                  Array.from(gameState.units.values()).filter((unit: any) => unit.playerId === player.id).length : 0;
                
                return (
                  <div
                    key={player.id}
                    className={`p-3 rounded border-2 transition-all ${
                      isCurrentPlayer 
                        ? 'border-yellow-500 bg-yellow-900 bg-opacity-30' 
                        : 'border-gray-600 bg-gray-800'
                    }`}
                    style={{ borderLeftWidth: '6px', borderLeftColor: player.color }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {player.username}
                          {isMe && <span className="text-xs text-blue-400 ml-1">(You)</span>}
                        </span>
                        {isCurrentPlayer && (
                          <span className="text-xs bg-yellow-600 text-yellow-100 px-2 py-1 rounded">
                            🎯 TURN
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-400">
                          {unitCount} units
                        </div>
                        {player.actionPoints !== undefined && (
                          <div className="text-xs text-blue-400">
                            AP: {player.actionPoints}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className={`${
                        player.isActive !== false ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {player.isActive !== false ? '🟢 Online' : '🔴 Offline'}
                      </span>
                      <span className={`${
                        player.isReady ? 'text-green-400' : 'text-gray-400'
                      }`}>
                        {player.isReady ? '✅ Ready' : '⏳ Not Ready'}
                      </span>
                    </div>
                  </div>
                );
              })}
              
              {!gameState && gameData?.players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-2 bg-gray-700 rounded opacity-50"
                  style={{ borderLeft: `4px solid ${player.color}` }}
                >
                  <span>{player.user.username} (Database)</span>
                  <span className="text-sm text-gray-500">
                    Connecting...
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* My Units */}
          {gameState && gameState.units && engineRef.current?.isMyTurn() && (
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-bold mb-4">Your Units</h3>
              <div className="space-y-2">
                {Array.from(gameState.units.values())
                  .filter((unit: any) => unit.playerId === user?.id)
                  .map((unit: any) => (
                    <div
                      key={unit.id}
                      className={`p-2 rounded border transition-all cursor-pointer hover:bg-gray-700 ${
                        engineRef.current?.getSelectedUnitId() === unit.id
                          ? 'border-yellow-500 bg-yellow-900 bg-opacity-30'
                          : 'border-gray-600 bg-gray-800'
                      }`}
                      onClick={() => engineRef.current?.selectUnit(unit.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">
                            {getUnitTypeIcon(unit.type)} {unit.type}
                          </span>
                          {(unit.hasMoved || unit.hasAttacked) && (
                            <span className="text-xs bg-gray-600 text-gray-300 px-1 rounded">
                              {unit.hasMoved && unit.hasAttacked ? 'Used' : unit.hasMoved ? 'Moved' : 'Attacked'}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          ({unit.position.x}, {unit.position.z})
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-xs">
                          <span className="text-red-400">❤️ {unit.health}/{unit.maxHealth}</span>
                          <span className="ml-2 text-blue-400">⚔️ {unit.attack}</span>
                          <span className="ml-2 text-green-400">🛡️ {unit.defense}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          Move: {unit.movement} | Range: {unit.range}
                        </div>
                      </div>
                    </div>
                  ))}
                {Array.from(gameState.units.values()).filter((unit: any) => unit.playerId === user?.id).length === 0 && (
                  <div className="text-center text-gray-400 py-4">
                    No units remaining
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat & Game Log */}
          <div className="flex-1 flex flex-col p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Game Log</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDebugLogs(!showDebugLogs)}
                  className={`text-xs px-2 py-1 rounded ${
                    showDebugLogs ? 'bg-blue-600' : 'bg-gray-600'
                  }`}
                  title="Toggle debug logs"
                >
                  Debug
                </button>
              </div>
            </div>
            
            <div ref={gameLogRef} className="flex-1 overflow-y-auto space-y-1 mb-4 text-sm">
              {gameLog
                .filter(entry => showDebugLogs || entry.type !== 'debug')
                .map((entry) => {
                  const timeStr = new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  
                  return (
                    <div key={entry.id} className={`p-2 rounded ${getLogEntryStyle(entry.type)}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {entry.type === 'chat' && entry.username && (
                            <span className="font-bold text-blue-300">{entry.username}: </span>
                          )}
                          {entry.type !== 'chat' && entry.username && (
                            <span className="font-bold text-gray-300">{entry.username} </span>
                          )}
                          <span className={getMessageStyle(entry.type)}>{entry.message}</span>
                        </div>
                        <span className="text-xs text-gray-500 ml-2">{timeStr}</span>
                      </div>
                      {entry.type === 'player_event' && (
                        <div className="text-xs text-gray-400 mt-1">
                          {getEventIcon(entry.metadata?.event)} {entry.metadata?.event}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                className="input flex-1"
                placeholder="Type a message..."
              />
              <button onClick={sendChatMessage} className="btn btn-secondary">
                Send
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

export default GamePage; 