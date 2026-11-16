import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogIn, LockKeyhole } from 'lucide-react-native';
import { useSession } from '../auth/session';
import { Button, Field, Notice, Screen, Txt } from '../components/ui';
import { useTheme } from '../theme';
import { Touch } from '../components/motion';
import { RecordHeading } from '../components/headers';

export function LoginScreen() {
  const { colors, dark } = useTheme();
  const insets = useSafeAreaInsets();
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
    <StatusBar style="dark" />
    <Screen fullScreen backgroundColor={colors.background} contentStyle={local.loginPage}>
    <View style={[local.brand, { backgroundColor: colors.primary }]}>
      <View style={local.logoBackground}>
        <Image source={require('../../assets/product-mark.png')} style={local.logo} contentFit="contain" accessibilityLabel="Assurance" />
      </View>
      <Txt style={[local.brandName, { color: colors.onPrimary }]}>VOTRE ESPACE ASSURANCE</Txt>
      <Txt title style={[local.heading, { color: colors.onPrimary }]}>Connexion</Txt>
    </View>
    <Svg width="100%" height={86} viewBox="0 0 390 86" preserveAspectRatio="none" pointerEvents="none" accessible={false}>
      <Path d="M0 0H390V1C351 22 354 65 300 66C263 67 247 57 211 72C158 97 119 84 91 59C61 32 39 31 0 18Z" fill={colors.primary} />
    </Svg>
      <View style={local.form}>
      <Field centered label="Identifiant" value={identifier}
        onChangeText={setIdentifier} autoCapitalize="none" autoCorrect={false} editable={!busy}
        autoComplete="username" textContentType="username" />
      <Field centered label="Mot de passe" value={password} onChangeText={setPassword} secret autoCapitalize="none" autoCorrect={false}
        autoComplete="current-password" textContentType="password" editable={!busy} returnKeyType="go" onSubmitEditing={() => { if (identifier && password) void submit(); }} />
      {error ? <Notice message={error} error /> : null}
      <Touch accessibilityRole="button" accessibilityLabel="Se connecter"
        accessibilityState={{ disabled: busy || !identifier.trim() || !password, busy }}
        disabled={busy || !identifier.trim() || !password} onPress={() => void submit()}
        style={({ pressed }) => [local.loginButton, { borderColor: dark ? colors.primary : colors.dock, backgroundColor: dark ? colors.primary : colors.dock,
          opacity: busy || !identifier.trim() || !password ? 0.55 : pressed ? 0.75 : 1 }]}>
        {busy ? <ActivityIndicator color={dark ? colors.onPrimary : colors.onDock} /> : <LogIn size={21} color={dark ? colors.onPrimary : colors.onDock} />}
        <Txt style={[local.loginButtonText, { color: dark ? colors.onPrimary : colors.onDock }]}>Se connecter</Txt>
      </Touch>
      </View>
      <View style={local.security}><LockKeyhole size={16} color={colors.text} /><Txt style={local.securityText}>Accès sécurisé</Txt></View>
    </Screen>
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: colors.primary }} />
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
    <RecordHeading title={required ? 'Sécurisez votre compte' : 'Mot de passe'} category="Sécurité" icon={LockKeyhole} />
    {required && <Notice message="Remplacez le mot de passe temporaire remis par votre agence." />}
    <Field label="Mot de passe actuel" secret value={current} onChangeText={setCurrent} autoComplete="current-password" editable={!busy} />
    <Field label={`Nouveau mot de passe (${minimum} caractères minimum)`} secret value={next} onChangeText={setNext} autoComplete="new-password" editable={!busy} />
    <Field label="Confirmer le nouveau mot de passe" secret value={confirmation} onChangeText={setConfirmation} autoComplete="new-password" editable={!busy} />
    {error ? <Notice message={error} error /> : null}
    <Button title="Modifier le mot de passe" icon={LockKeyhole} busy={busy} disabled={!current || !next || !confirmation} onPress={() => void submit()} />
    {required && <Button title="Se déconnecter" secondary disabled={busy} onPress={() => void logout().catch(() => {})} />}
  </Screen></KeyboardAvoidingView>;
}
const local = StyleSheet.create({
  fill: { flex: 1 }, loginPage: { padding: 0, paddingBottom: 20, gap: 0 },
  brand: { gap: 18, paddingTop: 30, paddingBottom: 20, paddingHorizontal: 24, alignItems: 'center' },
  logoBackground: { width: 76, height: 76, borderRadius: 22, borderCurve: 'continuous', backgroundColor: '#ffffff', padding: 4, alignItems: 'center', justifyContent: 'center' },
  // Compensate for the artwork's uneven transparent horizontal margins.
  logo: { width: 68, height: 68, transform: [{ translateX: -1 }] },
  brandName: { fontSize: 11, fontWeight: '600' }, heading: { fontSize: 34, lineHeight: 44 },
  form: { gap: 22, paddingHorizontal: 26, paddingTop: 16, paddingBottom: 24, width: '100%', maxWidth: 440, alignSelf: 'center' },
  loginButton: { minHeight: 52, borderRadius: 28, borderWidth: 1.5, marginTop: 6, paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  loginButtonText: { fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  security: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: 20, marginTop: 'auto' },
  securityText: { fontSize: 13 },
});
