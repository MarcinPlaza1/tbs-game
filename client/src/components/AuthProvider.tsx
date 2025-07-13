import { useEffect, ReactNode } from 'react';
import { useAuthStore } from '../stores/authStore';
import { trpc } from '../providers/TrpcProvider';

interface AuthProviderProps {
  children: ReactNode;
}

function AuthProvider({ children }: AuthProviderProps) {
  const { token, refreshToken, setLoading, login, logout } = useAuthStore();

  const refreshTokenMutation = trpc.auth.refresh.useMutation({
    onSuccess: (data) => {
      login(data.user, data.token, data.refreshToken);
    },
    onError: () => {
      logout();
    },
    onSettled: () => {
      setLoading(false);
    },
  });

  useEffect(() => {
    // Check authentication on app start
    const checkAuth = async () => {
      // If we have both tokens, app was restored from storage
      if (token && refreshToken) {
        // Try to refresh to validate tokens
        refreshTokenMutation.mutate({ refreshToken });
      } else {
        // No tokens, user is not authenticated
        setLoading(false);
      }
    };

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount - ignore dependencies to prevent re-runs

  return <>{children}</>;
}

export default AuthProvider; 