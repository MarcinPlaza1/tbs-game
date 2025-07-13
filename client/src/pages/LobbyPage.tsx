// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../providers/TrpcProvider';
import { useAuthStore } from '../stores/authStore';
import GameCard from '../components/GameCard';
import GameCardSkeleton from '../components/GameCardSkeleton';
import { toast } from 'react-hot-toast';

function LobbyPage() {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMapId, setSelectedMapId] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
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
      toast.error(gamesQueryError.message);
    }
    if (mapsError && mapsQueryError) {
      toast.error(mapsQueryError.message);
    }
  }, [gamesError, mapsError, gamesQueryError, mapsQueryError]);

  const createGameMutation = trpc.game.create.useMutation({
    onSuccess: (game) => {
      console.log('✅ Game created successfully:', game.id);
      toast.success('Game created');
      navigate(`/game/${game.id}`);
    },
    onError: (error) => {
      console.error('❌ Failed to create game:', error);
      toast.error(error.message);
    },
  });

  const joinGameMutation = trpc.game.join.useMutation({
    onSuccess: (_, variables) => {
      console.log('✅ Joined game successfully:', variables.gameId);
      toast.success('Joined game');
      navigate(`/game/${variables.gameId}`);
    },
    onError: (error) => {
      console.error('❌ Failed to join game:', error);
      toast.error(error.message);
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
    if (!showCreateModal) return;

    // focus first element (select)
    selectRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowCreateModal(false);
      }

      // basic focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCreateModal]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold" aria-label="Lobby heading">Game Lobby</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
          aria-label="Create new game"
        >
          Create New Game
        </button>
      </div>
      {/* Loading state */}
      {gamesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Loading games list">
          {Array.from({ length: 6 }).map((_, idx) => (
            <GameCardSkeleton key={idx} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {games?.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              userId={user?.id}
              onJoin={handleJoinGame}
              joinLoading={joinGameMutation.isLoading}
            />
          ))}
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
            ref={modalRef}
          >
            <h2 className="text-2xl font-bold mb-4">Create New Game</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Map</label>
              <select
                ref={selectRef}
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