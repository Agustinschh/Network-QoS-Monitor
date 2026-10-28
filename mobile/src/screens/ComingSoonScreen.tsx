import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography } from '../theme';

/**
 * Pantalla provisoria para las secciones que se implementan en fases
 * posteriores (Mapa: Fase 6, Historial: Fase 6, Ajustes: Fases 4/7).
 */
export function ComingSoonScreen({ title, phase }: { title: string; phase: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <Text style={typography.title}>{title}</Text>
      <Text style={[typography.caption, styles.text]}>Se implementa en la {phase}.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  text: { marginTop: spacing.sm },
});
