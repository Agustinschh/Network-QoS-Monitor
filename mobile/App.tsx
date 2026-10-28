/**
 * QoS Monitor — punto de entrada de la app.
 *
 * @format
 */

import React, { useEffect } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from './src/database/db';
import { RootNavigator } from './src/navigation/RootNavigator';
import { OnboardingScreen } from './src/screens/OnboardingScreen/OnboardingScreen';
import { startNetworkMonitoring } from './src/store/networkStore';
import { usePermissionStore } from './src/store/permissionStore';
import { colors } from './src/theme';

function App() {
  const { loaded, onboardingDone, refresh } = usePermissionStore();

  useEffect(() => {
    initDatabase();
    refresh();
    return startNetworkMonitoring();
  }, [refresh]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {!loaded ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : onboardingDone ? (
        <RootNavigator />
      ) : (
        <OnboardingScreen />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default App;
