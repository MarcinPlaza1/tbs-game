import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../providers/TrpcProvider';
import { useAuthStore } from '../stores/authStore';

function LobbyPage() {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const user = useAuthStore((state) => state.user);

  const {
    data: games,
    isLoading: gamesLoading,
    isError: gamesError,
    error: gamesQueryError,
  } = trpc.game.list.useQuery();

  const {
    data: maps,
    isLoading: mapsLoading,
    isError: mapsError,
    error: mapsQueryError,
  } = trpc.map.list.useQuery();

  // Show query errors in banner
  useEffect(() => {
    if (gamesError && gamesQueryError) {
      setErrorMessage(gamesQueryError.message);
    }
    if (mapsError && mapsQueryError) {
      setErrorMessage(mapsQueryError.message);
    }
  }, [gamesError, mapsError, gamesQueryError, mapsQueryError]);

  const createGameMutation = trpc.game.create.useMutation({
    onSuccess: (game) => {
      console.log('✅ Game created successfully:', game.id);
      navigate(`/game/${game.id}`);
    },
    onError: (error) => {
      console.error('❌ Failed to create game:', error);
      setErrorMessage(error.message);
    },
  });

  const joinGameMutation = trpc.game.join.useMutation({
    onSuccess: (_, variables) => {
      console.log('✅ Joined game successfully:', variables.gameId);
      navigate(`/game/${variables.gameId}`);
    },
    onError: (error) => {
      console.error('❌ Failed to join game:', error);
      setErrorMessage(error.message);
      // If already in game, just navigate to it
      if (error.message.includes('Already in this game')) {
        const gameId = error.message.match(/game\/([a-f0-9-]+)/)?.[1];
        if (gameId) {
          navigate(`/game/${gameId}`);
        }
      }
    },
  });

  const handleCreateGame = () => {
    if (!selectedMapId) return;
    
    console.log('🎮 Creating new game...', { mapId: selectedMapId });
    createGameMutation.mutate({
      mapId: selectedMapId,
      settings: {
        maxPlayers: 4,
        turnTimeLimit: 300,
        isPrivate: false,
      },
    });
  };

  const handleJoinGame = (gameId: string) => {
    if (!user) return;
    
    // Check if user is already in this game
    const game = games?.find(g => g.id === gameId);
    const isAlreadyInGame = game?.players.some(p => p.userId === user.id);
    
    if (isAlreadyInGame) {
      console.log('🔄 User already in game, navigating directly...');
      navigate(`/game/${gameId}`);
      return;
    }
    
    console.log('👥 Joining game...', gameId);
    joinGameMutation.mutate({ gameId });
  };

  // Close modal on ESC press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
      }
    };

    if (showCreateModal) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Global error banner */}
      {errorMessage && (
        <div className="mb-4 p-3 rounded bg-game-danger/30 border border-game-danger text-red-300 flex justify-between items-start">
          <span>{errorMessage}</span>
          <button
            className="ml-4 text-red-200 hover:text-red-100"
            onClick={() => setErrorMessage('')}
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Game Lobby</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          Create New Game
        </button>
      </div>

      {/* Loading state */}
      {gamesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="card h-40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {games?.map((game) => {
          const isUserInGame = game.players.some(p => p.userId === user?.id);
          const settings = game.settings as any;
          
          const isFull = game.players.length >= (settings?.maxPlayers || 0);

          return (
            <div key={game.id} className="card">
              <h3 className="text-xl font-bold mb-2">{game.map?.name || 'Unknown Map'}</h3>
              <p className="text-gray-400 mb-4">
                Players: {game.players.length}/{settings.maxPlayers}
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {game.players.map((player) => (
                  <span
                    key={player.id}
                    className={`px-2 py-1 rounded text-sm ${
                      player.userId === user?.id ? 'bg-game-accent text-white' : 'bg-gray-700'
                    }`}
                    style={{ borderColor: player.color, borderWidth: '2px' }}
                  >
                    {player.user.username}
                  </span>
                ))}
              </div>
              <button
                onClick={() => handleJoinGame(game.id)}
                disabled={joinGameMutation.isLoading || isFull}
                className={`btn w-full ${
                  isUserInGame ? 'btn-secondary' : isFull ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'
                }`}
              >
                {isUserInGame ? 'Continue Game' : isFull ? 'Full' : 'Join Game'}
              </button>
            </div>
          );
        })}
      </div>
      )}

      {(!gamesLoading && games?.length === 0) && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No games available. Create one to get started!</p>
        </div>
      )}

      {/* Create Game Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="card max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-2xl font-bold mb-4">Create New Game</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Map</label>
              <select
                value={selectedMapId}
                onChange={(e) => setSelectedMapId(e.target.value)}
                className="input w-full"
              >
                <option value="">Choose a map...</option>
                {mapsLoading && (
                  <option disabled>Loading maps...</option>
                )}
                {maps?.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name} ({map.width}x{map.height})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreateGame}
                disabled={!selectedMapId || createGameMutation.isLoading}
                className="btn btn-primary flex-1"
              >
                {createGameMutation.isLoading ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LobbyPage; 