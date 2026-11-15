import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, View, type TextInputProps, type StyleProp,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import { AlertCircle, ChevronRight, Eye, EyeOff, Inbox, Search, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme';
import { label } from '../lib/domain';

export function Txt({ children, muted = false, title = false, style }: {
  children: ReactNode; muted?: boolean; title?: boolean; style?: StyleProp<import('react-native').TextStyle>;
}) {
  const { colors } = useTheme();
  return <Text style={[styles.text, { color: muted ? colors.muted : colors.text }, title && styles.title, style]}>{children}</Text>;
}
export function Button({ title, onPress, icon: Icon, secondary, busy, disabled, danger }: {
  title: string; onPress: () => void; icon?: LucideIcon; secondary?: boolean; busy?: boolean; disabled?: boolean; danger?: boolean;
}) {
  const { colors } = useTheme();
  const foreground = secondary ? danger ? colors.danger : colors.primary : colors.onPrimary;
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: secondary ? colors.surface : colors.primary,
      borderColor: secondary ? colors.border : colors.primary, opacity: disabled || busy ? 0.45 : pressed ? 0.75 : 1 }]}>
    {busy ? <ActivityIndicator color={foreground} /> : Icon ? <Icon size={20} color={foreground} /> : null}
    <Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>
  </Pressable>;
}
export function Field({ label: name, secret, ...props }: TextInputProps & { label: string; secret?: boolean }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  return <View style={styles.field}>
    <Txt style={styles.label}>{name}</Txt>
    <View style={[styles.inputFrame, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TextInput {...props} accessibilityLabel={name} secureTextEntry={secret && !visible}
        placeholderTextColor={colors.muted} selectionColor={colors.primary}
        style={[styles.input, { color: colors.text }]} />
      {secret && <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        onPress={() => setVisible(!visible)} style={styles.iconButton}>
        {visible ? <EyeOff size={21} color={colors.muted} /> : <Eye size={21} color={colors.muted} />}
      </Pressable>}
    </View>
  </View>;
}
export function Choices<T extends string>({ value, options, onChange }: {
  value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return <View style={styles.choices} accessibilityRole="radiogroup">{options.map((option) => (
    <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }}
      onPress={() => onChange(option.value)} style={[styles.choice, { borderColor: value === option.value ? colors.primary : colors.border,
        backgroundColor: value === option.value ? colors.tint : colors.surface }]}>
      <Text style={[styles.choiceText, { color: value === option.value ? colors.primary : colors.muted }]}>{option.label}</Text>
    </Pressable>
  ))}</View>;
}
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section}><Txt style={styles.sectionTitle}>{title}</Txt>{children}</View>;
}
export function Detail({ label: name, value }: { label: string; value?: string | number | null }) {
  const { colors } = useTheme();
  return <View style={[styles.detail, { borderBottomColor: colors.border }]}>
    <Txt muted>{name}</Txt><Txt style={styles.detailValue}>{value == null || value === '' ? '-' : value}</Txt>
  </View>;
}
export function Status({ value }: { value?: string | null }) {
  const { colors } = useTheme();
  return <View style={[styles.status, { backgroundColor: colors.tint }]}><Text style={[styles.statusText, { color: colors.primary }]}>{label(value)}</Text></View>;
}
export function Row({ title, subtitle, meta, status, onPress, icon: Icon }: {
  title: string; subtitle?: string; meta?: string; status?: string | null; onPress?: () => void; icon?: LucideIcon;
}) {
  const { colors } = useTheme();
  const content = <>
    {Icon && <Icon size={22} color={colors.primary} />}
    <View style={styles.rowBody}><Txt style={styles.rowTitle}>{title}</Txt>
      {subtitle ? <Txt muted>{subtitle}</Txt> : null}
      {meta ? <Txt muted style={styles.meta}>{meta}</Txt> : null}
      {status ? <Status value={status} /> : null}
    </View>
    {onPress && <ChevronRight size={20} color={colors.muted} />}
  </>;
  const rowStyle = [styles.row, { borderBottomColor: colors.border, backgroundColor: colors.surface }];
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [...rowStyle, { opacity: pressed ? 0.65 : 1 }]}>{content}</Pressable>
    : <View style={rowStyle}>{content}</View>;
}
export function Notice({ message, error = false }: { message: string; error?: boolean }) {
  const { colors } = useTheme();
  return <View style={[styles.notice, { borderColor: error ? colors.danger : colors.border }]}>
    <AlertCircle size={20} color={error ? colors.danger : colors.blue} />
    <Text accessibilityRole={error ? 'alert' : undefined} style={[styles.noticeText, { color: error ? colors.danger : colors.muted }]}>{message}</Text>
  </View>;
}
export function State({ loading, error, empty, retry }: { loading?: boolean; error?: Error | null; empty?: string; retry?: () => void }) {
  const { colors } = useTheme();
  return <View style={styles.state}>
    {loading ? <><ActivityIndicator size="large" color={colors.primary} /><Txt muted>Chargement…</Txt></>
      : error ? <><Notice message={error.message} error />{retry && <Button title="Réessayer" secondary onPress={retry} />}</>
        : <><Inbox size={30} color={colors.muted} /><Txt muted>{empty ?? 'Aucun résultat.'}</Txt></>}
  </View>;
}
function NetworkNotice() {
  const network = useNetInfo();
  return network.isConnected === false || network.isInternetReachable === false
    ? <View style={styles.network}><Notice message="Hors connexion. Reconnectez-vous au réseau pour actualiser vos dossiers." /></View>
    : null;
}
export function Screen({ children, refresh, refreshing = false, fullScreen = false }: { children: ReactNode; refresh?: () => void; refreshing?: boolean; fullScreen?: boolean }) {
  const { colors } = useTheme();
  return <SafeAreaView edges={fullScreen ? ['top', 'left', 'right', 'bottom'] : ['left', 'right', 'bottom']} style={[styles.fill, { backgroundColor: colors.background }]}>
    <NetworkNotice />
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled"
      refreshControl={refresh ? <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} /> : undefined}>
      {children}
    </ScrollView>
  </SafeAreaView>;
}
export function Collection<T extends { id: string }>({ items, render, loading, error, refresh, refreshing, next, more, fetchingMore,
  header, empty }: {
    items: T[]; render: (item: T) => ReactNode; loading: boolean; error?: Error | null;
    refresh: () => void; refreshing: boolean; next: () => void; more?: boolean; fetchingMore: boolean;
    header?: ReactNode; empty?: string;
  }) {
  const { colors } = useTheme();
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.fill, { backgroundColor: colors.background }]}>
    <NetworkNotice />
    <FlatList data={items} keyExtractor={(item) => item.id} renderItem={({ item }) => <>{render(item)}</>}
      contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" initialNumToRender={12}
      ListHeaderComponent={<>{header}{error && items.length > 0 && <Notice message={error.message} error />}</>}
      ListEmptyComponent={<State loading={loading} error={error} empty={empty} retry={refresh} />}
      ListFooterComponent={more ? <View style={styles.footer}><Button title="Afficher la suite" secondary onPress={next} busy={fetchingMore} /></View> : null}
      onRefresh={refresh} refreshing={refreshing} progressViewOffset={0} />
  </SafeAreaView>;
}
export function SearchBar({ onSearch, placeholder = 'Rechercher' }: { onSearch: (value: string) => void; placeholder?: string }) {
  const [value, setValue] = useState('');
  return <View style={styles.search}>
    <Field label="Recherche" placeholder={placeholder} value={value} onChangeText={setValue}
      autoCapitalize="none" returnKeyType="search" onSubmitEditing={() => onSearch(value.trim())} />
    <Button title="Rechercher" secondary icon={Search} onPress={() => onSearch(value.trim())} />
  </View>;
}
export const styles = StyleSheet.create({
  fill: { flex: 1 }, page: { padding: 20, gap: 16, paddingBottom: 32, flexGrow: 1 },
  text: { fontSize: 16, lineHeight: 23, letterSpacing: 0 }, title: { fontSize: 26, lineHeight: 33, fontWeight: '700' },
  button: { minHeight: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 11,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontSize: 16, fontWeight: '600', flexShrink: 1, textAlign: 'center' },
  field: { gap: 7 }, label: { fontWeight: '500', fontSize: 15 }, inputFrame: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8 },
  input: { flex: 1, minWidth: 0, fontSize: 16, paddingHorizontal: 13, paddingVertical: 12, minHeight: 50 },
  iconButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { flexGrow: 1, flexBasis: 80, minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderRadius: 8, justifyContent: 'center' },
  choiceText: { textAlign: 'center', fontSize: 15, fontWeight: '600' },
  section: { gap: 8, paddingTop: 12 }, sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  detail: { paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, gap: 3 }, detailValue: { fontWeight: '500', fontVariant: ['tabular-nums'] },
  status: { borderRadius: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 },
  statusText: { fontSize: 13, fontWeight: '600' }, row: { paddingHorizontal: 16, paddingVertical: 17, minHeight: 72,
    flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowBody: { flex: 1, minWidth: 0, gap: 3 }, rowTitle: { fontWeight: '600' }, meta: { fontSize: 13, lineHeight: 19 },
  notice: { borderWidth: 1, borderRadius: 8, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeText: { flex: 1, fontSize: 15, lineHeight: 22 }, state: { padding: 24, gap: 16, alignItems: 'center', minHeight: 180, justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 32, flexGrow: 1 }, footer: { paddingTop: 16 }, search: { gap: 10, paddingBottom: 20 },
  network: { paddingHorizontal: 16, paddingVertical: 8 },
});
