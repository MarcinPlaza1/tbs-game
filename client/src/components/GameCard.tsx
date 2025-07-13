// ---- Types --------------------------------------------------------------
interface MapInfo {
  name: string;
}

interface UserInfo {
  username: string;
}

interface PlayerInfo {
  id: string;
  userId: string;
  user: UserInfo;
  color: string;
}

interface GameSettingsInfo {
  maxPlayers: number;
}

export interface GameListItem {
  id: string;
  map?: MapInfo;
  players: PlayerInfo[];
  settings: GameSettingsInfo;
}

export interface GameCardProps {
  game: GameListItem;
  userId?: string;
  onJoin: (gameId: string) => void;
  joinLoading: boolean;
}

// ------------------------------------------------------------------------

function GameCard({ game, userId, onJoin, joinLoading }: GameCardProps) {
  const isUserInGame = game.players.some((p) => p.userId === userId);
  const { maxPlayers } = game.settings;
  const isFull = game.players.length >= maxPlayers;

  const statusText = isFull ? 'Full' : 'Open';
  const statusColor = isFull ? 'bg-red-600' : 'bg-green-600';

  return (
    <div className="card" role="listitem" aria-label={`Game card for ${game.map?.name || 'Unknown Map'}`}>
      <h3 className="text-xl font-bold mb-2">{game.map?.name || 'Unknown Map'}</h3>
      <div className="flex items-center justify-between mb-4">
        <p className="text-gray-400">
          Players: {game.players.length}/{maxPlayers}
        </p>
        <span
          className={`text-xs px-2 py-1 rounded-full uppercase tracking-wide ${statusColor}`}
          aria-label={`Game status: ${statusText}`}
        >
          {statusText}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {game.players.map((player) => (
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