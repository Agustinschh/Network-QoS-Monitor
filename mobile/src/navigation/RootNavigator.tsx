import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import {
  createBottomTabNavigator,
  type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../screens/DashboardScreen/DashboardScreen';
import { ComingSoonScreen } from '../screens/ComingSoonScreen';
import { colors } from '../theme';

export type RootTabParamList = {
  Dashboard: undefined;
  Mapa: undefined;
  Historial: undefined;
  Ajustes: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    border: colors.border,
    primary: colors.primary,
    text: colors.text,
  },
};

// Íconos con emoji para no sumar una librería de íconos todavía.
const ICONS: Record<keyof RootTabParamList, string> = {
  Dashboard: '📶',
  Mapa: '🗺️',
  Historial: '📈',
  Ajustes: '⚙️',
};

function TabIcon({ name, focused }: { name: keyof RootTabParamList; focused: boolean }) {
  return <Text style={[styles.icon, !focused && styles.iconInactive]}>{ICONS[name]}</Text>;
}

import { SettingsScreen } from '../screens/SettingsScreen/SettingsScreen';
import { HistoryScreen } from '../screens/HistoryScreen/HistoryScreen';
import { MapCoverageScreen } from '../screens/MapScreen/MapCoverageScreen';

const screenOptions = ({
  route,
}: {
  route: { name: keyof RootTabParamList };
}): BottomTabNavigationOptions => ({
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
});

export function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator screenOptions={screenOptions}>
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Mapa" component={MapCoverageScreen} />
        <Tab.Screen name="Historial" component={HistoryScreen} />
        <Tab.Screen name="Ajustes" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  icon: { fontSize: 20 },
  iconInactive: { opacity: 0.5 },
});
