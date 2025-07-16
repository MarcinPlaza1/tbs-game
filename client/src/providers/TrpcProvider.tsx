import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import type { AppRouter } from '../../../server/src/trpc/router';
import { useAuthStore } from '../stores/authStore';

export const trpc = createTRPCReact<AppRouter>();

export function TrpcProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  
  const [trpcClient] = useState(() => {
    let isRefreshing = false;
    let refreshPromise: Promise<any> | null = null;

    const refreshToken = async () => {
      if (isRefreshing && refreshPromise) {
        return refreshPromise;
      }

      isRefreshing = true;
      const { refreshToken } = useAuthStore.getState();
      
      if (!refreshToken) {
        useAuthStore.getState().logout();
        throw new Error('No refresh token available');
      }

      refreshPromise = fetch('http://localhost:3000/trpc/auth.refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error('Failed to refresh token');
          }
          return res.json();
        })
        .then((data) => {
          if (data.result?.data) {
            const { token, refreshToken: newRefreshToken, user } = data.result.data;
            useAuthStore.getState().login(user, token, newRefreshToken);
            return token;
          }
          throw new Error('Invalid refresh response');
        })
        .catch((error) => {
          useAuthStore.getState().logout();
          throw error;
        })
        .finally(() => {
          isRefreshing = false;
          refreshPromise = null;
        });

      return refreshPromise;
    };

    return trpc.createClient({
      links: [
        httpBatchLink({
          url: 'http://localhost:3000',
          headers() {
            // Dynamically get token on each request
            const token = useAuthStore.getState().token;
            return token ? { authorization: `Bearer ${token}` } : {};
          },
          fetch: async (url, options) => {
            const response = await fetch(url, options);
            
            // Check if we got a 401 error
            if (response.status === 401 && !isRefreshing) {
              try {
                await refreshToken();
                
                // Retry the original request with the new token
                const newToken = useAuthStore.getState().token;
                const newOptions = {
                  ...options,
                  headers: {
                    ...options?.headers,
                    authorization: newToken ? `Bearer ${newToken}` : '',
                  },
                };
                
                return fetch(url, newOptions);
              } catch (error) {
                // Refresh failed, return original response
                return response;
              }
            }
            
            return response;
          },
        }),
      ],
    });
  });

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
} 