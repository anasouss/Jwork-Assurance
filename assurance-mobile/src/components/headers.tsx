import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme';
import { Status, Txt } from './ui';

export function ModuleHeader({ title, subtitle }: { title: string; subtitle?: string | null }) {
  const { colors } = useTheme();
  return <View>
    <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: colors.primary }}>
      <View style={styles.module}>
        <View style={styles.brandLine}>
          <View style={styles.markBackground}>
            <Image source={require('../../assets/product-mark.png')} style={styles.mark} contentFit="contain" accessibilityLabel="Assurance" />
          </View>
          <Txt style={[styles.subtitle, { color: colors.onPrimary }]}>{subtitle || 'Mon espace assurance'}</Txt>
        </View>
        <Txt title style={[styles.moduleTitle, { color: colors.onPrimary }]}>{title}</Txt>
      </View>
    </SafeAreaView>
    <Svg width="100%" height={26} viewBox="0 0 390 26" preserveAspectRatio="none" pointerEvents="none" accessible={false}>
      <Path d="M0 0H390C330 0 315 21 263 16C208 10 199 26 146 26C86 26 69 9 0 6Z" fill={colors.primary} />
    </Svg>
  </View>;
}

export function RecordHeading({ title, category, subtitle, status, icon: Icon }: {
  title: string; category: string; subtitle?: string | null; status?: string | null; icon: LucideIcon;
}) {
  const { colors } = useTheme();
  return <View style={[styles.record, { borderBottomColor: colors.border }]}>
    <View style={styles.categoryLine}>
      <View style={[styles.recordIcon, { backgroundColor: colors.tint }]}><Icon size={22} color={colors.text} /></View>
      <Txt muted style={styles.category}>{category}</Txt>
    </View>
    <Txt title style={styles.recordTitle}>{title}</Txt>
    {subtitle ? <Txt muted>{subtitle}</Txt> : null}
    {status ? <Status value={status} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  module: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 12, gap: 14 },
  brandLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  markBackground: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  mark: { width: 32, height: 32 },
  subtitle: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  moduleTitle: { fontSize: 27, lineHeight: 35 },
  record: { gap: 10, paddingBottom: 22, borderBottomWidth: StyleSheet.hairlineWidth },
  categoryLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  recordIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  category: { fontSize: 13, fontWeight: '600', flex: 1 },
  recordTitle: { fontSize: 24, lineHeight: 33 },
});
