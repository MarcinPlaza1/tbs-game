import { Routes, Route, Navigate } from 'react-router-dom';
import { TrpcProvider } from './providers/TrpcProvider';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import { useAuthStore } from './stores/authStore';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <TrpcProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
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
    </TrpcProvider>
  );
}

export default App; 