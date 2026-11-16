import { useContext, useState, type ReactNode } from 'react';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import {
  ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, View, type TextInputProps, type StyleProp,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetInfo } from '@react-native-community/netinfo';
import { AlertCircle, ChevronRight, Eye, EyeOff, Inbox, Search, X, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme';
import { label } from '../lib/domain';
import { Touch } from './motion';
import { fonts } from '../typography';

export function Txt({ children, muted = false, title = false, style }: {
  children: ReactNode; muted?: boolean; title?: boolean; style?: StyleProp<import('react-native').TextStyle>;
}) {
  const { colors } = useTheme();
  const weight = StyleSheet.flatten(style)?.fontWeight ?? (title ? '700' : '400');
  const family = Number(weight) >= 700 || weight === 'bold' ? fonts.bold : Number(weight) >= 500 ? fonts.semibold : fonts.regular;
  return <Text style={[styles.text, { color: muted ? colors.muted : colors.text }, title && styles.title, style,
    { fontFamily: family, fontWeight: 'normal' }]}>{children}</Text>;
}
export function Button({ title, onPress, icon: Icon, secondary, busy, disabled, danger }: {
  title: string; onPress: () => void; icon?: LucideIcon; secondary?: boolean; busy?: boolean; disabled?: boolean; danger?: boolean;
}) {
  const { colors } = useTheme();
  const foreground = disabled ? colors.muted : secondary ? danger ? colors.danger : colors.text : colors.onPrimary;
  return <Touch accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor: disabled ? colors.tint : secondary ? colors.surface : colors.primary,
      borderColor: disabled || secondary ? colors.border : colors.primary, opacity: busy ? 0.7 : pressed ? 0.75 : 1 }]}>
    {busy ? <ActivityIndicator color={foreground} /> : Icon ? <Icon size={20} color={foreground} /> : null}
    <Text style={[styles.buttonText, { color: foreground }]}>{title}</Text>
  </Touch>;
}
export function Field({ label: name, secret, centered = false, ...props }: TextInputProps & { label: string; secret?: boolean; centered?: boolean }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return <View style={styles.field}>
    <Txt style={[styles.label, centered && { textAlign: 'center' }]}>{name}</Txt>
    <View style={[styles.inputFrame, centered && { borderRadius: 28 }, { backgroundColor: colors.surface, borderColor: focused ? colors.primary : colors.border }]}>
      {centered && secret && <View style={{ width: 48 }} />}
      <TextInput {...props} accessibilityLabel={name} secureTextEntry={secret && !visible}
        onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
        placeholderTextColor={colors.muted} selectionColor={colors.primary}
        style={[styles.input, { color: colors.text }, centered && { textAlign: 'center', minHeight: 50, paddingVertical: 12 }]} />
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
  return <View style={[styles.choices, { backgroundColor: colors.surface }]} accessibilityRole="radiogroup">{options.map((option) => (
    <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }}
      onPress={() => onChange(option.value)} style={[styles.choice, { borderColor: value === option.value ? colors.primary : colors.border,
        backgroundColor: value === option.value ? colors.primary : colors.surface }]}>
      <Text style={[styles.choiceText, { color: value === option.value ? colors.onPrimary : colors.muted }]}>{option.label}</Text>
    </Pressable>
  ))}</View>;
}
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <View style={styles.section}><Txt style={styles.sectionTitle}>{title}</Txt>{children}</View>;
}
export function Detail({ label: name, value }: { label: string; value?: string | number | null }) {
  const { colors } = useTheme();
  return <View style={[styles.detail, { borderBottomColor: colors.border }]}>
    <Txt muted style={styles.detailLabel}>{name}</Txt><Txt style={styles.detailValue}>{value == null || value === '' ? '-' : value}</Txt>
  </View>;
}
export function Status({ value }: { value?: string | null }) {
  const { colors } = useTheme();
  const color = ['CANCELLED', 'ANNULE', 'REJETE', 'REFUSE'].includes(value ?? '') ? colors.danger
    : ['DRAFT', 'BROUILLON', 'EXPIRED', 'CLOTURE'].includes(value ?? '') ? colors.muted
      : ['ACTIVE', 'VALIDE', 'REGLE'].includes(value ?? '') ? colors.green : colors.blue;
  return <View style={[styles.status, { backgroundColor: colors.background, borderColor: colors.border }]}>
    <View style={[styles.statusDot, { backgroundColor: color }]} />
    <Text style={[styles.statusText, { color }]}>{label(value)}</Text>
  </View>;
}
export function Row({ title, subtitle, meta, status, onPress, icon: Icon, busy, disabled }: {
  title: string; subtitle?: string; meta?: string; status?: string | null; onPress?: () => void; icon?: LucideIcon; busy?: boolean; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const content = <>
    {Icon && <View style={[styles.rowIcon, { backgroundColor: colors.tint }]}><Icon size={21} color={colors.text} /></View>}
    <View style={styles.rowBody}><Txt style={styles.rowTitle}>{title}</Txt>
      {subtitle ? <Txt muted>{subtitle}</Txt> : null}
      {meta ? <Txt muted style={styles.meta}>{meta}</Txt> : null}
      {status ? <Status value={status} /> : null}
    </View>
    {busy ? <ActivityIndicator color={colors.primary} /> : onPress && <View style={[styles.rowArrow, { backgroundColor: colors.background }]}><ChevronRight size={17} color={colors.text} /></View>}
  </>;
  const rowStyle = [styles.row, { borderColor: colors.border, backgroundColor: colors.surface }];
  return onPress ? <Touch accessibilityRole="button" accessibilityState={{ busy, disabled: disabled || busy }} disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [...rowStyle, { opacity: pressed || disabled ? 0.65 : 1 }]}>{content}</Touch>
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
        : <><View style={[styles.emptyIcon, { backgroundColor: colors.tint }]}><Inbox size={28} color={colors.text} /></View><Txt muted style={styles.stateText}>{empty ?? 'Aucun résultat.'}</Txt></>}
  </View>;
}
function NetworkNotice() {
  const network = useNetInfo();
  return network.isConnected === false || network.isInternetReachable === false
    ? <View style={styles.network}><Notice message="Hors connexion. Reconnectez-vous au réseau pour actualiser vos dossiers." /></View>
    : null;
}
export function Screen({ children, refresh, refreshing = false, fullScreen = false, topInset = false, backgroundColor, contentStyle }: { children: ReactNode; refresh?: () => void; refreshing?: boolean; fullScreen?: boolean; topInset?: boolean; backgroundColor?: string; contentStyle?: StyleProp<import('react-native').ViewStyle> }) {
  const { colors } = useTheme();
  const dockHeight = useContext(BottomTabBarHeightContext) ?? 0;
  return <SafeAreaView edges={fullScreen ? ['top', 'left', 'right', 'bottom'] : topInset ? ['top', 'left', 'right'] : ['left', 'right']} style={[styles.fill, { backgroundColor: backgroundColor ?? colors.background }]}>
    <NetworkNotice />
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: 24 + dockHeight }, contentStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
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
  const dockHeight = useContext(BottomTabBarHeightContext) ?? 0;
  return <SafeAreaView edges={['left', 'right']} style={[styles.fill, { backgroundColor: colors.background }]}>
    <NetworkNotice />
    <FlatList data={items} keyExtractor={(item) => item.id} renderItem={({ item }) => <>{render(item)}</>}
      contentContainerStyle={[styles.list, { paddingBottom: 32 + dockHeight }]} keyboardShouldPersistTaps="handled" initialNumToRender={12} showsVerticalScrollIndicator={false}
      ListHeaderComponent={header || (error && items.length > 0) ? <View style={styles.listHeader}>{header}{error && items.length > 0 && <Notice message={error.message} error />}</View> : null}
      ListEmptyComponent={<State loading={loading} error={error} empty={empty} retry={refresh} />}
      ListFooterComponent={more ? <View style={styles.footer}><Button title="Afficher la suite" secondary onPress={next} busy={fetchingMore} /></View> : null}
      onRefresh={refresh} refreshing={refreshing} progressViewOffset={0} />
  </SafeAreaView>;
}
export function SearchBar({ onSearch, placeholder = 'Rechercher' }: { onSearch: (value: string) => void; placeholder?: string }) {
  const [value, setValue] = useState('');
  const { colors } = useTheme();
  return <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <TextInput accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor={colors.muted}
      style={[styles.input, { color: colors.text }]} value={value} onChangeText={setValue}
      autoCapitalize="none" returnKeyType="search" onSubmitEditing={() => onSearch(value.trim())} />
    {value.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche" onPress={() => { setValue(''); onSearch(''); }} style={styles.iconButton}>
      <X size={18} color={colors.muted} />
    </Pressable>}
    <Pressable accessibilityRole="button" accessibilityLabel="Rechercher" onPress={() => onSearch(value.trim())} style={[styles.searchButton, { backgroundColor: colors.primary }]}>
      <Search size={21} color={colors.onPrimary} />
    </Pressable>
  </View>;
}
export const styles = StyleSheet.create({
  fill: { flex: 1 }, page: { padding: 22, gap: 20, paddingBottom: 24, flexGrow: 1 },
  text: { fontSize: 15, lineHeight: 22, letterSpacing: 0 }, title: { fontSize: 28, lineHeight: 35, fontWeight: '700' },
  button: { minHeight: 54, borderRadius: 28, borderWidth: 1, paddingHorizontal: 22, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontSize: 15, lineHeight: 24, fontFamily: fonts.bold, flexShrink: 1, textAlign: 'center' },
  field: { gap: 10 }, label: { fontWeight: '500', fontSize: 14 }, inputFrame: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 18 },
  input: { flex: 1, minWidth: 0, fontSize: 15, fontFamily: fonts.regular, paddingHorizontal: 18, paddingVertical: 15, minHeight: 56 },
  iconButton: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 4, borderRadius: 28 },
  choice: { flexGrow: 1, flexBasis: 80, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 24, justifyContent: 'center' },
  choiceText: { textAlign: 'center', fontSize: 13, fontFamily: fonts.bold },
  section: { gap: 10, paddingTop: 8 }, sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: '700', marginBottom: 6 },
  detail: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start' },
  detailLabel: { flexBasis: 110, flexGrow: 1, fontSize: 13 }, detailValue: { flexBasis: 150, flexGrow: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
  status: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: fonts.semibold, flexShrink: 1 }, row: { paddingHorizontal: 16, paddingVertical: 18, minHeight: 80,
    flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, borderCurve: 'continuous', borderWidth: StyleSheet.hairlineWidth, marginBottom: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  rowArrow: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 5 }, rowTitle: { fontWeight: '700', fontSize: 16 }, meta: { fontSize: 12, lineHeight: 18 },
  notice: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  noticeText: { flex: 1, fontSize: 15, lineHeight: 22, fontFamily: fonts.regular }, state: { padding: 24, gap: 16, alignItems: 'center', minHeight: 180, justifyContent: 'center' },
  emptyIcon: { width: 64, height: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, stateText: { textAlign: 'center' },
  list: { padding: 22, paddingBottom: 32, flexGrow: 1 }, listHeader: { gap: 12, paddingBottom: 20 }, footer: { paddingTop: 16 },
  search: { flexDirection: 'row', alignItems: 'center', borderRadius: 30, borderWidth: StyleSheet.hairlineWidth, paddingRight: 5 },
  searchButton: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  network: { paddingHorizontal: 16, paddingVertical: 8 },
});
