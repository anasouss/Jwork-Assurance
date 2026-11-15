import { useState } from 'react';
import { Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { LogOut, LockKeyhole, Phone } from 'lucide-react-native';
import { useSession } from '../auth/session';
import { useTheme, type Appearance } from '../theme';
import { Button, Choices, Detail, Screen, Section, Txt } from '../components/ui';

export function AccountScreen() {
  const { session, logout } = useSession();
  const { appearance, setAppearance } = useTheme();
  const [busy, setBusy] = useState(false);
  function signOut() {
    Alert.alert('Se déconnecter ?', '', [{ text: 'Annuler', style: 'cancel' }, { text: 'Se déconnecter', style: 'destructive', onPress: () => {
      setBusy(true);
      void logout().catch(() => Alert.alert('Déconnecté sur cet appareil', 'La révocation sur le serveur n’a pas pu être confirmée.'))
        .finally(() => setBusy(false));
    } }]);
  }
  const telephone = session?.profile?.agenceTelephone;
  return <Screen>
    <Txt title>{session?.profile?.nom ?? session?.user?.fullName}</Txt>
    <Detail label="Espace" value={session?.space === 'client' ? 'Client' : session?.space === 'platform' ? 'Super administrateur' : 'Agence'} />
    <Detail label="Agence" value={session?.profile?.agenceNom ?? session?.user?.agenceName} />
    {session?.user && <Detail label="Rôle" value={session.user.roleName ?? session.user.roleCode} />}
    <Section title="Apparence"><Choices<Appearance> value={appearance} onChange={setAppearance}
      options={[{ value: 'system', label: 'Système' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]} /></Section>
    <Section title="Sécurité"><Button title="Modifier le mot de passe" icon={LockKeyhole} secondary onPress={() => router.push('/password')} />
      <Button title="Se déconnecter" icon={LogOut} secondary danger busy={busy} onPress={signOut} /></Section>
    {telephone && <Section title="Votre agence"><Button title="Appeler l’agence" icon={Phone} secondary onPress={() => {
      const number = telephone.replace(/[^+0-9]/g, '');
      if (number) void Linking.openURL(`tel:${number}`).catch(() => Alert.alert('Appel indisponible'));
    }} /></Section>}
  </Screen>;
}
