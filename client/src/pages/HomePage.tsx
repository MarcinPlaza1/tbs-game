import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

function HomePage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="max-w-4xl mx-auto px-4 text-center">
        <h1 className="text-6xl font-bold text-game-accent mb-4">
          Turn Based Strategy
        </h1>
        <p className="text-xl text-gray-300 mb-8">
          Command your armies, conquer territories, and outsmart your opponents
          in this epic turn-based strategy game!
        </p>
        <div className="flex gap-4 justify-center">
          {isAuthenticated ? (
            <Link to="/lobby" className="btn btn-primary text-lg px-8 py-3">
              Enter Game Lobby
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn btn-primary text-lg px-8 py-3">
                Play Now
              </Link>
              <Link to="/login" className="btn btn-secondary text-lg px-8 py-3">
                Login
              </Link>
            </>
          )}
        </div>
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="card">
            <h3 className="text-xl font-bold text-game-accent mb-2">Strategic Combat</h3>
            <p className="text-gray-400">
              Plan your moves carefully. Every decision counts in turn-based battles.
            </p>
          </div>
          <div className="card">
            <h3 className="text-xl font-bold text-game-accent mb-2">Multiple Units</h3>
            <p className="text-gray-400">
              Command warriors, archers, mages, and more unique unit types.
            </p>
          </div>
          <div className="card">
            <h3 className="text-xl font-bold text-game-accent mb-2">Real-time Multiplayer</h3>
            <p className="text-gray-400">
              Battle against players from around the world in real-time matches.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage; 