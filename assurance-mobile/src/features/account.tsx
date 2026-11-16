import { useState } from 'react';
import { Alert, Linking, View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { LogOut, LockKeyhole, Phone } from 'lucide-react-native';
import { useSession } from '../auth/session';
import { useTheme, type Appearance } from '../theme';
import { Button, Choices, Detail, Row, Screen, Section, Txt } from '../components/ui';

export function AccountScreen() {
  const { session, logout } = useSession();
  const { appearance, setAppearance, colors } = useTheme();
  const [busy, setBusy] = useState(false);
  function signOut() {
    Alert.alert('Se déconnecter ?', '', [{ text: 'Annuler', style: 'cancel' }, { text: 'Se déconnecter', style: 'destructive', onPress: () => {
      setBusy(true);
      void logout().catch(() => Alert.alert('Déconnecté sur cet appareil', 'La révocation sur le serveur n’a pas pu être confirmée.'))
        .finally(() => setBusy(false));
    } }]);
  }
  const telephone = session?.profile?.agenceTelephone;
  const name = session?.profile?.nom ?? session?.user?.fullName ?? '-';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('');
  return <Screen>
    <View style={[local.profile, { backgroundColor: colors.surface }]}>
      <View style={[local.avatar, { backgroundColor: colors.primary }]}><Txt style={[local.initials, { color: colors.onPrimary }]}>{initials}</Txt></View>
      <Txt title style={local.name}>{name}</Txt>
      {session?.user?.email && <Txt muted style={local.email}>{session.user.email}</Txt>}
    </View>
    <Section title="Informations du compte">
    <Detail label="Espace" value={session?.space === 'client' ? 'Client' : session?.space === 'platform' ? 'Super administrateur' : 'Agence'} />
    <Detail label="Agence" value={session?.profile?.agenceNom ?? session?.user?.agenceName} />
    {session?.user && <Detail label="Rôle" value={session.user.roleName ?? session.user.roleCode} />}
    </Section>
    <Section title="Apparence"><Choices<Appearance> value={appearance} onChange={setAppearance}
      options={[{ value: 'system', label: 'Système' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]} /></Section>
    <Section title="Sécurité"><Row title="Mot de passe" subtitle="Modifier mon mot de passe" icon={LockKeyhole} onPress={() => router.push('/password')} />
      <Button title="Se déconnecter" icon={LogOut} secondary danger busy={busy} onPress={signOut} /></Section>
    {telephone && <Section title="Votre agence"><Button title="Appeler l’agence" icon={Phone} secondary onPress={() => {
      const number = telephone.replace(/[^+0-9]/g, '');
      if (number) void Linking.openURL(`tel:${number}`).catch(() => Alert.alert('Appel indisponible'));
    }} /></Section>}
  </Screen>;
}
const local = StyleSheet.create({
  profile: { alignItems: 'center', gap: 12, paddingVertical: 24, paddingHorizontal: 22, marginHorizontal: -22, marginTop: -22, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  avatar: { width: 72, height: 72, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  email: { textAlign: 'center' },
  initials: { fontSize: 28, lineHeight: 36, fontWeight: '700' }, name: { textAlign: 'center', fontSize: 24, lineHeight: 32 },
});
