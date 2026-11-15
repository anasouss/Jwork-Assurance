import { Component, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Providers } from '../src/providers';
import { useSession } from '../src/auth/session';
import { useTheme } from '../src/theme';
import { Button, Screen, State } from '../src/components/ui';
import { DocumentPrivacy } from '../src/features/documents';

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <Screen><State empty="Cet écran n’a pas pu s’ouvrir." />
      <Button title="Réessayer" onPress={() => this.setState({ failed: false })} /></Screen> : this.props.children;
  }
}
function Navigation() {
  const { session, restoring, restoreError, restore, logout } = useSession();
  const { colors, dark } = useTheme();
  if (restoring || restoreError) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <State loading={restoring} error={restoreError ? new Error(restoreError) : undefined} retry={() => void restore()} />
    {restoreError && <Button title="Revenir à la connexion" secondary onPress={() => void logout().catch(() => {}).then(() => void restore())} />}
  </SafeAreaView>;
  const passwordRequired = !!session?.profile?.passwordChangeRequired;
  return <><StatusBar style={dark ? 'light' : 'dark'} /><DocumentPrivacy /><ErrorBoundary>
    <Stack screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.surface }, contentStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}>
      <Stack.Protected guard={!session}><Stack.Screen name="login" options={{ headerShown: false }} /></Stack.Protected>
      <Stack.Protected guard={!!session && !passwordRequired}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="detail/[resource]/[id]" options={{ title: 'Dossier' }} />
      </Stack.Protected>
      <Stack.Protected guard={session?.space === 'platform'}>
        <Stack.Screen name="agency/[id]" options={{ title: 'Agence' }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="password" options={{ title: 'Sécurité', headerBackVisible: !passwordRequired, gestureEnabled: !passwordRequired }} />
      </Stack.Protected>
    </Stack>
  </ErrorBoundary></>;
}
export default function RootLayout() { return <Providers><Navigation /></Providers>; }
