import { Tabs } from 'expo-router/js-tabs';
import { Building2, FileText, House, ShieldCheck, UserRound, Users, Wrench } from 'lucide-react-native';
import { useSession } from '../../src/auth/session';
import { useTheme } from '../../src/theme';
import { canRead } from '../../src/lib/domain';
import { NavigationDock } from '../../src/components/navigation';
import { ModuleHeader } from '../../src/components/headers';

export default function TabLayout() {
  const { session } = useSession();
  const { colors } = useTheme();
  const space = session?.space ?? '';
  const permissions = session?.user?.permissions ?? [];
  const homeTitle = space === 'client' ? 'Mes assurances' : space === 'platform' ? 'Vue des agences' : 'Mon activité';
  const agency = session?.profile?.agenceNom ?? session?.user?.agenceName;
  return <Tabs tabBar={(props) => <NavigationDock {...props} />} screenOptions={{ tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 },
    tabBarItemStyle: { minHeight: 48, borderRadius: 8, marginHorizontal: 3 },
    tabBarActiveBackgroundColor: colors.tint, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    tabBarHideOnKeyboard: true, animation: 'none',
    header: ({ route, options }) => <ModuleHeader title={route.name === 'index' ? homeTitle : options.title ?? route.name}
      subtitle={route.name === 'index' ? [session?.profile?.nom ?? session?.user?.fullName, agency].filter(Boolean).join(' · ') : agency} />,
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
