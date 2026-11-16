import { useContext, useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, Keyboard, Pressable, LayoutAnimation } from 'react-native';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { useTheme } from '../theme';
import { fonts } from '../typography';
import { useReducedMotion } from './motion';

export function NavigationDock({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const reduced = useReducedMotion();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const selectedKey = state.routes[state.index]?.key;
  const [expandedKey, setExpandedKey] = useState(selectedKey);

  useLayoutEffect(() => {
    if (expandedKey === selectedKey) return;
    if (!reduced && !keyboardOpen) {
      LayoutAnimation.configureNext({
        duration: 180,
        create: { type: 'easeInEaseOut', property: 'opacity' },
        update: { type: 'easeInEaseOut' },
        delete: { type: 'easeInEaseOut', property: 'opacity' },
      });
    }
    // Selection never depends on an animation callback or a measured text width.
    setExpandedKey(selectedKey);
  }, [expandedKey, selectedKey, reduced, keyboardOpen]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (keyboardOpen) return null;
  return <View pointerEvents="box-none" onLayout={(event) => reportHeight?.(event.nativeEvent.layout.height)}
    style={[styles.area, { paddingBottom: Math.max(insets.bottom, 12) }]}>
    <View style={[styles.dock, { backgroundColor: colors.dock }]}>
      {state.routes.map((route) => {
        const { options } = descriptors[route.key];
        const selected = route.key === selectedKey;
        const expanded = route.key === expandedKey;
        const color = expanded ? colors.onPrimary : colors.onDock;
        const title = options.title ?? route.name;
        return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={title}
          accessibilityState={{ selected }}
          style={[styles.item, { flex: expanded ? 1.8 : 1, backgroundColor: expanded ? colors.primary : 'transparent' }]}
          onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
          onPress={() => {
            const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!selected && !event.defaultPrevented) navigateToTab(route.key);
          }}>
          <View style={styles.content} pointerEvents="none">
            <View style={styles.icon}>{options.tabBarIcon?.({ focused: selected, color, size: 22 })}</View>
            {expanded && <Text style={[styles.label, { color }]}>{title}</Text>}
          </View>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  area: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 8, alignItems: 'center' },
  dock: { flexDirection: 'row', width: '100%', maxWidth: 520, padding: 7, borderRadius: 32, gap: 2 },
  item: { minWidth: 0, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8, maxWidth: '100%' },
  icon: { width: 26, height: 26, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, lineHeight: 20, includeFontPadding: false, textAlignVertical: 'center', fontFamily: fonts.bold, textAlign: 'center', flexShrink: 1 },
});
