import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: User, token: string, refreshToken: string) => void;
  logout: () => void;
  setTokens: (token: string, refreshToken: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: true, // Start with loading true
      login: (user, token, refreshToken) => set({ user, token, refreshToken, isAuthenticated: true, isLoading: false }),
      logout: () => set({ user: null, token: null, refreshToken: null, isAuthenticated: false, isLoading: false }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      setLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage',
    }
  )
); 