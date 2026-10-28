import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePermissionStore } from '../../store/permissionStore';
import type { PermissionKey, PermissionStatus } from '../../types';
import { colors, radius, spacing, typography } from '../../theme';

interface Step {
  key: PermissionKey;
  title: string;
  description: string;
  required: boolean;
}

/** Orden importante: la ubicación en background va después de la de primer plano. */
const STEPS: Step[] = [
  {
    key: 'location',
    title: 'Ubicación',
    description: 'Para georreferenciar cada medición y construir el mapa de cobertura.',
    required: true,
  },
  {
    key: 'phoneState',
    title: 'Estado del teléfono',
    description: 'Para leer el operador, la tecnología (4G/5G) y el nivel de señal celular.',
    required: false,
  },
  {
    key: 'notifications',
    title: 'Notificaciones',
    description: 'Para avisarte cuando la calidad de la red se degrade.',
    required: false,
  },
  {
    key: 'backgroundLocation',
    title: 'Ubicación en segundo plano',
    description: 'Para registrar mediciones periódicas con la app cerrada. Elegí "Permitir siempre".',
    required: false,
  },
];

const STATUS_LABEL: Record<PermissionStatus, string> = {
  granted: 'Concedido',
  denied: 'Denegado',
  blocked: 'Bloqueado (activalo en Ajustes)',
  unavailable: 'No disponible',
  unknown: 'Pendiente',
};

export function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { statuses, request, completeOnboarding } = usePermissionStore();
  const [busy, setBusy] = useState<PermissionKey | null>(null);

  const onRequest = async (key: PermissionKey) => {
    setBusy(key);
    try {
      await request(key);
    } finally {
      setBusy(null);
    }
  };

  const canContinue = statuses.location === 'granted';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.badge}>QoS MONITOR</Text>
      <Text style={typography.title}>Medí la calidad de tu red</Text>
      <Text style={[typography.caption, styles.lead]}>
        Necesitamos algunos permisos para medir latencia, velocidad y cobertura en cada lugar.
      </Text>

      {STEPS.map(step => {
        const status = statuses[step.key];
        const granted = status === 'granted';
        const locked = step.key === 'backgroundLocation' && statuses.location !== 'granted';
        return (
          <View key={step.key} style={[styles.card, granted && styles.cardGranted]}>
            <View style={styles.cardHeader}>
              <Text style={typography.subtitle}>{step.title}</Text>
              {step.required && <Text style={styles.required}>Requerido</Text>}
            </View>
            <Text style={[typography.caption, styles.cardText]}>{step.description}</Text>
            <View style={styles.cardFooter}>
              <Text style={[styles.status, granted && { color: colors.good }]}>
                {STATUS_LABEL[status]}
              </Text>
              {!granted && (
                <Pressable
                  testID={`permission-${step.key}`}
                  disabled={locked || busy !== null || status === 'blocked'}
                  onPress={() => onRequest(step.key)}
                  style={({ pressed }) => [
                    styles.button,
                    (locked || status === 'blocked') && styles.buttonDisabled,
                    pressed && styles.buttonPressed,
                  ]}>
                  <Text style={styles.buttonText}>{busy === step.key ? '...' : 'Permitir'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}

      <Pressable
        testID="onboarding-continue"
        disabled={!canContinue}
        onPress={completeOnboarding}
        style={({ pressed }) => [
          styles.cta,
          !canContinue && styles.buttonDisabled,
          pressed && styles.buttonPressed,
        ]}>
        <Text style={styles.ctaText}>Continuar</Text>
      </Pressable>
      {!canContinue && (
        <Text style={[typography.caption, styles.hint]}>
          La ubicación es necesaria para continuar.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  badge: {
    color: colors.primary,
    fontWeight: '700',
    letterSpacing: 2,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  lead: { marginTop: spacing.sm, marginBottom: spacing.lg, fontSize: 15 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardGranted: { borderColor: colors.good },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  required: {
    color: colors.fair,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardText: { marginTop: spacing.xs },
  cardFooter: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  button: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  buttonText: { color: colors.primary, fontWeight: '700' },
  buttonDisabled: { opacity: 0.4 },
  buttonPressed: { opacity: 0.7 },
  cta: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hint: { textAlign: 'center', marginTop: spacing.sm },
});
