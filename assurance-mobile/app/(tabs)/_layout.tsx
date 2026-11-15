import { Tabs } from 'expo-router/js-tabs';
import { Building2, FileText, House, ShieldCheck, UserRound, Users, Wrench } from 'lucide-react-native';
import { useSession } from '../../src/auth/session';
import { useTheme } from '../../src/theme';
import { canRead } from '../../src/lib/domain';

export default function TabLayout() {
  const { session } = useSession();
  const { colors } = useTheme();
  const space = session?.space ?? '';
  const permissions = session?.user?.permissions ?? [];
  return <Tabs screenOptions={{ tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border }, tabBarItemStyle: { minHeight: 48 },
    headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.text, headerShadowVisible: false,
    sceneStyle: { backgroundColor: colors.background } }}>
    <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
    <Tabs.Protected guard={canRead(space, permissions, 'contracts')}>
      <Tabs.Screen name="contracts" options={{ title: 'Contrats', tabBarIcon: ({ color, size }) => <ShieldCheck color={color} size={size} /> }} />
    </Tabs.Protected>
    <Tabs.Protected guard={canRead(space, permissions, 'claims')}>
      <Tabs.Screen name="claims" options={{ title: 'Sinistres', tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} /> }} />
    </Tabs.Protected>
    <Tabs.Protected guard={space === 'client'}>
      <Tabs.Screen name="documents" options={{ title: 'Documents', tabBarIcon: ({ color, size }) => <FileText color={color} size={size} /> }} />
    </Tabs.Protected>
    <Tabs.Protected guard={canRead(space, permissions, 'clients')}>
      <Tabs.Screen name="clients" options={{ title: 'Clients', tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
    </Tabs.Protected>
    <Tabs.Protected guard={space === 'platform'}>
      <Tabs.Screen name="agencies" options={{ title: 'Agences', tabBarIcon: ({ color, size }) => <Building2 color={color} size={size} /> }} />
    </Tabs.Protected>
    <Tabs.Screen name="account" options={{ title: 'Compte', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size} /> }} />
  </Tabs>;
}
