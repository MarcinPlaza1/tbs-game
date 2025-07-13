// @ts-nocheck
import React from 'react';

interface GameCardProps {
  game: any;
  userId?: string;
  onJoin: (gameId: string) => void;
  joinLoading: boolean;
}

function GameCard({ game, userId, onJoin, joinLoading }: GameCardProps) {
  const isUserInGame = game.players.some((p: any) => p.userId === userId);
  const settings = game.settings as any;
  const isFull = game.players.length >= (settings?.maxPlayers || 0);

  return (
    <div className="card" aria-label={`Game ${game.map?.name || 'Unknown Map'}`}>
      <h3 className="text-xl font-bold mb-2">{game.map?.name || 'Unknown Map'}</h3>
      <p className="text-gray-400 mb-4">
        Players: {game.players.length}/{settings.maxPlayers}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {game.players.map((player: any) => (
          <span
            key={player.id}
            className={`px-2 py-1 rounded text-sm ${
              player.userId === userId ? 'bg-game-accent text-white' : 'bg-gray-700'
            }`}
            style={{ borderColor: player.color, borderWidth: '2px' }}
          >
            {player.user.username}
          </span>
        ))}
      </div>
      <button
        onClick={() => onJoin(game.id)}
        disabled={joinLoading || isFull}
        className={`btn w-full ${
          isUserInGame ? 'btn-secondary' : isFull ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'
        }`}
        aria-label={
          isUserInGame
            ? `Continue game ${game.id}`
            : isFull
            ? `Game ${game.id} is full`
            : `Join game ${game.id}`
        }
      >
        {isUserInGame ? 'Continue Game' : isFull ? 'Full' : 'Join Game'}
      </button>
    </div>
  );
}

export default GameCard;