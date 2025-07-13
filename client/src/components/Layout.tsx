import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { trpc } from '../providers/TrpcProvider';

function Layout() {
  const { isAuthenticated, user, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      logout();
      navigate('/');
    },
    onError: (error) => {
      // Even if API call fails, logout locally for security
      console.error('Logout API error:', error);
      logout();
      navigate('/');
    },
  });

  const handleLogout = () => {
    if (refreshToken) {
      logoutMutation.mutate({ refreshToken });
    } else {
      // No refresh token, just logout locally
      logout();
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-game-primary border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-game-accent">
                TBS Game
              </Link>
              <div className="ml-10 flex items-baseline space-x-4">
                <Link to="/" className="text-gray-300 hover:text-white px-3 py-2 rounded-md">
                  Home
                </Link>
                {isAuthenticated && (
                  <>
                    <Link to="/lobby" className="text-gray-300 hover:text-white px-3 py-2 rounded-md">
                      Lobby
                    </Link>
                    <Link to="/settings" className="text-gray-300 hover:text-white px-3 py-2 rounded-md">
                      Settings
                    </Link>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <span className="text-gray-300">Welcome, {user?.username}!</span>
                  <button
                    onClick={handleLogout}
                    className="btn btn-secondary"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn btn-secondary">
                    Login
                  </Link>
                  <Link to="/register" className="btn btn-primary">
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-game-primary border-t border-gray-700 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400">
          © 2024 Turn Based Strategy Game
        </div>
      </footer>
    </div>
  );
}

export default Layout; 