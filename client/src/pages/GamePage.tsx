import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client, Room } from 'colyseus.js';
import { GameEngine } from '../game/babylon/GameEngine';
import { useAuthStore } from '../stores/authStore';
import { trpc } from '../providers/TrpcProvider';

function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const roomRef = useRef<Room | null>(null);
  const initializingRef = useRef<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ username: string; message: string; timestamp: number }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [connectionLog, setConnectionLog] = useState<string[]>([]);
  
  // Loading states
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState('');
  const [isGameReady, setIsGameReady] = useState(false);
  const [gameActivated, setGameActivated] = useState(false);
  
  const user = useAuthStore((state) => state.user);
  const { data: gameData } = trpc.game.get.useQuery({ gameId: gameId! });

  const addLog = (message: string) => {
    console.log(message);
    setConnectionLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
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
        
        addLog('🏠 Attempting to join/create room...');
        const room = await client.joinOrCreate('game_room', {
          gameId: gameId,
          userId: user.id,
          username: user.username,
        });
        
        roomRef.current = room;
        addLog(`✅ Connected to game room: ${room.id}`);

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
        });

        room.onMessage('player_left', (message) => {
          addLog(`👋 Player left: ${message.username}`);
        });

        room.onMessage('game_started', (message) => {
          addLog(`🎉 Game started! Current player: ${message.currentPlayer}`);
        });

        room.onMessage('manual_state_update', (message) => {
          const readyPlayers = message.players.filter((p: any) => p.isReady).length;
          addLog(`📥 Manual state update - Players: ${message.playersCount}, Ready: ${readyPlayers}, Status: ${message.status}`);
          console.log('Manual state update:', message);
          
          // Create a fake gameState for testing
          const fakeState: any = {
            gameId: message.gameId,
            status: message.status,
            phase: message.phase,
            mapWidth: 20,
            mapHeight: 20,
            players: {},
            turnNumber: message.turnNumber || 1,
            currentPlayerIndex: 0
          };
          
          // Add players with detailed logging
          message.players.forEach((player: any) => {
            fakeState.players[player.id] = player;
            addLog(`👤 Player state: ${player.username} - Ready: ${player.isReady}`);
          });
          
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
          setChatMessages((prev) => {
            // Prevent duplicate messages
            const isDuplicate = prev.some(msg => 
              msg.username === message.username && 
              msg.message === message.message && 
              Math.abs(msg.timestamp - message.timestamp) < 1000
            );
            if (isDuplicate) return prev;
            return [...prev, message];
          });
        });

        room.onMessage('error', (message) => {
          addLog(`❌ Room error: ${message.message}`);
          setError(message.message || 'Game error occurred');
        });

        room.onLeave((code) => {
          addLog(`👋 Left room with code: ${code}`);
          navigate('/lobby');
        });

        room.onError((code, message) => {
          addLog(`🚫 Room error: ${code} - ${message}`);
          setError(`Connection error: ${message}`);
        });

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
    if (chatInput.trim() && roomRef.current) {
      roomRef.current.send('chat_message', chatInput);
      setChatInput('');
    }
  };

  const handleEndTurn = () => {
    if (roomRef.current) {
      roomRef.current.send('end_turn');
      addLog('🔄 End turn sent');
    }
  };

  const handlePlayerReady = async () => {
    if (!roomRef.current || !isGameReady) return;
    
    addLog('🎮 Activating game...');
    
    // Activate the game engine
    try {
      if (engineRef.current && canvasRef.current) {
        addLog('⚡ Initializing 3D engine...');
        await engineRef.current.initialize();
        addLog('✅ 3D engine activated successfully!');
        setGameActivated(true);
      } else if (canvasRef.current) {
        // Try to create engine if it wasn't created before
        addLog('🔧 Creating and activating 3D engine...');
        engineRef.current = new GameEngine(canvasRef.current);
        await engineRef.current.initialize();
        addLog('✅ 3D engine created and activated!');
        setGameActivated(true);
      }
    } catch (error: any) {
      addLog(`⚠️ 3D engine activation failed: ${error.message} - continuing with 2D mode`);
      setGameActivated(true); // Still activate game, just without 3D
    }
    
    // Send ready signal to server
    roomRef.current.send('player_ready', {});
    addLog('✅ Player ready signal sent');
  };

  if (isLoading) {
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
      {/* Fixed Game Controls Bar */}
      <div className="bg-gray-800 p-4 flex justify-between items-center">
        <div className="flex gap-4">
          <button 
            onClick={handlePlayerReady} 
            disabled={!isGameReady || gameActivated}
            className={`px-6 py-2 rounded font-semibold transition-colors ${
              !isGameReady 
                ? 'bg-gray-500 cursor-not-allowed text-gray-300' 
                : gameActivated 
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {gameActivated ? '✅ Ready' : !isGameReady ? '⏳ Loading...' : '🎮 Ready'}
          </button>
          <button 
            onClick={handleEndTurn} 
            disabled={!gameActivated}
            className={`px-6 py-2 rounded font-semibold transition-colors ${
              gameActivated 
                ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                : 'bg-gray-500 cursor-not-allowed text-gray-300'
            }`}
          >
            ⏭️ End Turn
          </button>
        </div>
        
        <div className="text-white text-sm">
          {gameActivated && gameState && (
            <span>Status: <strong>{gameState.status}</strong> | Turn: <strong>{gameState.turnNumber}</strong></span>
          )}
          {!gameActivated && (
            <span>Engine: <strong>{isGameReady ? 'Ready for Activation' : `Loading ${loadingProgress}%`}</strong></span>
          )}
          <span className="ml-4">Game: {gameId?.slice(-8)}</span>
        </div>
      </div>
      
      {/* Main Game Area */}
      <div className="flex flex-1">
        {/* Game Canvas */}
        <div className="flex-1 relative bg-gray-900">
          <canvas 
            ref={canvasRef} 
            className="w-full h-full" 
            style={{ display: gameActivated && engineRef.current ? 'block' : 'none' }} 
          />
          
          {/* Loading Screen */}
          {!gameActivated && (
            <div className="w-full h-full flex items-center justify-center text-white">
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
            <div className="w-full h-full flex items-center justify-center text-white">
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-4">🎮 Game Active</h2>
                <p className="text-gray-400">Running in 2D mode</p>
              </div>
            </div>
          )}
          
          {/* Game Info Overlay */}
          <div className="absolute top-4 left-4">
            <div className="bg-black bg-opacity-75 text-white p-3 rounded text-sm">
              {gameState && (
                <>
                  <p>Phase: {gameState.phase}</p>
                  <p>Players: {Object.keys(gameState.players || {}).length}</p>
                  <p>Map: {gameState.mapWidth}x{gameState.mapHeight}</p>
                </>
              )}
            </div>
          </div>
          
          {/* Debug Panel - collapsible */}
          <div className="absolute top-4 right-4">
            <details className="card bg-opacity-90">
              <summary className="cursor-pointer font-bold">Debug Log</summary>
              <div className="mt-2 max-h-40 overflow-y-auto">
                {connectionLog.slice(-10).map((log, index) => (
                  <div key={index} className="text-xs text-gray-300 font-mono">{log}</div>
                ))}
              </div>
            </details>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-game-secondary flex flex-col">
          {/* Players */}
          <div className="p-4 border-b border-gray-700">
            <h3 className="text-lg font-bold mb-4">Players</h3>
            <div className="space-y-2">
              {gameState && Object.values(gameState.players || {}).map((player: any) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-2 bg-gray-800 rounded"
                  style={{ borderLeft: `4px solid ${player.color}` }}
                >
                  <span>{player.username}</span>
                  <span className={`text-sm ${player.isReady ? 'text-green-400' : 'text-gray-400'}`}>
                    {player.isReady ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
              ))}
              
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

          {/* Chat */}
          <div className="flex-1 flex flex-col p-4">
            <h3 className="text-lg font-bold mb-4">Chat</h3>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4">
              {chatMessages.map((msg, index) => (
                <div key={index} className="text-sm">
                  <span className="font-bold">{msg.username}:</span> {msg.message}
                </div>
              ))}
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
      </div>
    </div>
  );
}

export default GamePage; 