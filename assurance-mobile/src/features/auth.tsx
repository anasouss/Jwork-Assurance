import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LogIn, LockKeyhole } from 'lucide-react-native';
import { useSession } from '../auth/session';
import { Button, Field, Notice, Screen, Txt } from '../components/ui';

export function LoginScreen() {
  const { login } = useSession();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await login(identifier.trim(), password);
      setPassword('');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Connexion impossible.'); }
    finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={local.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <Screen fullScreen><View style={local.brand}>
      <Image source={require('../../assets/product-mark.png')} style={local.logo} contentFit="contain" accessibilityLabel="Assurance" />
      <Txt title>Votre espace assurance</Txt>
    </View>
      <Field label="Identifiant" value={identifier}
        onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} editable={!busy}
        autoComplete="username" textContentType="username" />
      <Field label="Mot de passe" value={password} onChangeText={setPassword} secret autoCapitalize="none" autoCorrect={false}
        autoComplete="current-password" textContentType="password" editable={!busy} returnKeyType="go" onSubmitEditing={() => { if (identifier && password) void submit(); }} />
      {error ? <Notice message={error} error /> : null}
      <Button title="Se connecter" icon={LogIn} onPress={() => void submit()} busy={busy}
        disabled={!identifier.trim() || !password} />
    </Screen>
  </KeyboardAvoidingView>;
}

export function PasswordScreen() {
  const { session, changePassword, logout } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const required = !!session?.profile?.passwordChangeRequired;
  const minimum = session?.kind === 'client' ? 12 : 8;
  async function submit() {
    if (busy) return;
    const bytes = Array.from(next).reduce((total, character) => {
      const code = character.codePointAt(0) ?? 0;
      return total + (code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4);
    }, 0);
    if (next.length < minimum || bytes > 72) {
      setError(`Utilisez au moins ${minimum} caractères, dans la limite de 72 octets.`); return;
    }
    if (next !== confirmation) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (next === current) { setError('Choisissez un mot de passe différent.'); return; }
    setBusy(true); setError('');
    try {
      await changePassword(current, next);
      Alert.alert('Mot de passe modifié', 'Reconnectez-vous avec votre nouveau mot de passe.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Modification impossible.'); }
    finally { setBusy(false); }
  }
  return <KeyboardAvoidingView style={local.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><Screen>
    <Txt title>{required ? 'Sécurisez votre compte' : 'Mot de passe'}</Txt>
    {required && <Notice message="Remplacez le mot de passe temporaire remis par votre agence." />}
    <Field label="Mot de passe actuel" secret value={current} onChangeText={setCurrent} autoComplete="current-password" editable={!busy} />
    <Field label={`Nouveau mot de passe (${minimum} caractères minimum)`} secret value={next} onChangeText={setNext} autoComplete="new-password" editable={!busy} />
    <Field label="Confirmer le nouveau mot de passe" secret value={confirmation} onChangeText={setConfirmation} autoComplete="new-password" editable={!busy} />
    {error ? <Notice message={error} error /> : null}
    <Button title="Modifier le mot de passe" icon={LockKeyhole} busy={busy} disabled={!current || !next || !confirmation} onPress={() => void submit()} />
    {required && <Button title="Se déconnecter" secondary disabled={busy} onPress={() => void logout().catch(() => {})} />}
  </Screen></KeyboardAvoidingView>;
}
const local = StyleSheet.create({ fill: { flex: 1 }, brand: { gap: 20, paddingTop: 24, paddingBottom: 20 }, logo: { width: 76, height: 76, backgroundColor: '#ffffff', borderRadius: 8 } });
