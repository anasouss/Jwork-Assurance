import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as SystemUI from 'expo-system-ui';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationTheme } from 'expo-router';

const light = {
  background: '#f5f7f6', surface: '#ffffff', text: '#18221e', muted: '#596760',
  border: '#d9e0dc', primary: '#087647', onPrimary: '#ffffff',
  tint: '#e7f4ec', blue: '#096996', danger: '#b32630', warning: '#865706',
};
const dark: typeof light = {
  background: '#151918', surface: '#202624', text: '#edf3ef', muted: '#b0beb5',
  border: '#3d4842', primary: '#79dca7', onPrimary: '#082b19',
  tint: '#233d2e', blue: '#83cbf2', danger: '#ffb0b4', warning: '#ebc77e',
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
