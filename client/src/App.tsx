import { Routes, Route, Navigate } from 'react-router-dom';
import { TrpcProvider } from './providers/TrpcProvider';
import Layout from './components/Layout';
import AuthProvider from './components/AuthProvider';
import LoadingScreen from './components/LoadingScreen';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import PasswordResetRequestPage from './pages/PasswordResetRequestPage';
import PasswordResetPage from './pages/PasswordResetPage';
import UserSettingsPage from './pages/UserSettingsPage';
import { useAuthStore } from './stores/authStore';

function App() {
  const { isAuthenticated, isLoading } = useAuthStore();

  return (
    <TrpcProvider>
      <AuthProvider>
        {isLoading ? (
          <LoadingScreen />
        ) : (
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route 
                path="login" 
                element={isAuthenticated ? <Navigate to="/lobby" replace /> : <LoginPage />} 
              />
              <Route 
                path="register" 
                element={isAuthenticated ? <Navigate to="/lobby" replace /> : <RegisterPage />} 
              />
              <Route 
                path="reset-password" 
                element={isAuthenticated ? <Navigate to="/lobby" replace /> : <PasswordResetRequestPage />} 
              />
              <Route 
                path="reset-password/:token" 
                element={isAuthenticated ? <Navigate to="/lobby" replace /> : <PasswordResetPage />} 
              />
              <Route 
                path="settings" 
                element={isAuthenticated ? <UserSettingsPage /> : <Navigate to="/login" replace />} 
              />
              <Route 
                path="lobby" 
                element={isAuthenticated ? <LobbyPage /> : <Navigate to="/login" replace />} 
              />
              <Route 
                path="game/:gameId" 
                element={isAuthenticated ? <GamePage /> : <Navigate to="/login" replace />} 
              />
            </Route>
          </Routes>
        )}
      </AuthProvider>
    </TrpcProvider>
  );
}

export default App; 