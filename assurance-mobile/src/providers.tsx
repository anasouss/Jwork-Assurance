import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from './auth/session';
import { ThemeProvider } from './theme';
import { ApiError } from './api/transport';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: {
    staleTime: 30_000, gcTime: 5 * 60_000,
    retry: (count, error) => count < 1 && (!(error instanceof ApiError) || error.status >= 500),
  } } }));
  useEffect(() => {
    const app = AppState.addEventListener('change', (state) => {
      if (Platform.OS !== 'web') focusManager.setFocused(state === 'active');
    });
    const network = NetInfo.addEventListener((state) => onlineManager.setOnline(state.isConnected !== false && state.isInternetReachable !== false));
    return () => { app.remove(); network(); };
  }, []);
  return <SafeAreaProvider><QueryClientProvider client={client}><ThemeProvider>
    <SessionProvider>{children}</SessionProvider>
  </ThemeProvider></QueryClientProvider></SafeAreaProvider>;
}
