import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationTheme } from 'expo-router';

const light = {
  background: '#f7f8fa', surface: '#ffffff', text: '#142136', muted: '#64707a',
  border: '#e2e6ec', primary: '#e7ae42', onPrimary: '#142136',
  tint: '#fff2d6', blue: '#24364f', danger: '#b32630', warning: '#865706',
  accent: '#e7ae42', green: '#26715b', greenTint: '#eaf4ef', blueTint: '#edf0f5',
  accentTint: '#fff2d6', dock: '#142136', onDock: '#edf0f5',
};
const dark: typeof light = {
  background: '#121619', surface: '#1c2227', text: '#f1f4f6', muted: '#a8b3bb',
  border: '#303940', primary: '#e7ae42', onPrimary: '#142136',
  tint: '#3b3020', blue: '#c6cfde', danger: '#ffb0b4', warning: '#ebc77e',
  accent: '#e7ae42', green: '#8bc9b2', greenTint: '#20352d', blueTint: '#273140',
  accentTint: '#3b3020', dock: '#142136', onDock: '#edf0f5',
};
export type Appearance = 'system' | 'light' | 'dark';
const Context = createContext({ colors: light, dark: false, appearance: 'system' as Appearance, setAppearance: (_: Appearance) => {} });
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [appearance, setValue] = useState<Appearance>('system');
  const isDark = (appearance === 'system' ? system : appearance) === 'dark';
  const colors = isDark ? dark : light;
  useEffect(() => {
    void SecureStore.getItemAsync('assurance.appearance').then((value) => {
      if (value === 'light' || value === 'dark' || value === 'system') setValue(value);
    }).catch(() => {});
  }, []);
  useEffect(() => { void SystemUI.setBackgroundColorAsync(colors.background).catch(() => {}); }, [colors.background]);
  function setAppearance(value: Appearance) {
    setValue(value);
    void SecureStore.setItemAsync('assurance.appearance', value).catch(() => {});
  }
  const navigation = isDark ? DarkTheme : DefaultTheme;
  return <Context.Provider value={{ colors, dark: isDark, appearance, setAppearance }}>
    <NavigationTheme value={{ ...navigation, colors: { ...navigation.colors, background: colors.background,
      card: colors.surface, text: colors.text, border: colors.border, primary: colors.primary } }}>
      {children}
    </NavigationTheme>
  </Context.Provider>;
}
export const useTheme = () => useContext(Context);
